import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth'; // Assuming @/ is configured for src/

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Server-side environment variable
const ORG = process.env.NEXT_PUBLIC_GITHUB_ORG || 'GalaxyKickLock';
const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'GalaxyKickPipeline';
const WORKFLOW_FILE_NAME = process.env.NEXT_PUBLIC_GITHUB_WORKFLOW_FILE || 'blank.yml';

const apiHeaders = {
  'Accept': 'application/vnd.github+json',
  'Authorization': `token ${GITHUB_TOKEN}`,
  'X-GitHub-Api-Version': '2022-11-28',
};

async function fetchFromGitHub(url: string, options: RequestInit = {}) {
  // GITHUB_TOKEN check is now part of the main handlers after session validation
  // if (!GITHUB_TOKEN) {
  //   console.error('GitHub token not configured on the server.');
  //   return NextResponse.json({ message: 'Server configuration error: GitHub token missing.' }, { status: 500 });
  // }
  
  const response = await fetch(url, { ...options, headers: { ...apiHeaders, ...options.headers } });
  
  if (!response.ok) {
    // Handle error responses from GitHub
    const errorData = await response.text();
    console.error(`GitHub API error: ${response.status} for URL ${url}`, errorData);
    try {
      const jsonData = JSON.parse(errorData);
      return NextResponse.json({ message: `GitHub API Error: ${response.status}`, error: jsonData }, { status: response.status });
    } catch (e) {
      return NextResponse.json({ message: `GitHub API Error: ${response.status}`, error: errorData }, { status: response.status });
    }
  }
  
  // Handle successful responses
  // For the 'cancel' POST request, GitHub returns 202 Accepted.
  if (options.method === 'POST' && response.status === 202) {
    return NextResponse.json({ message: 'Cancel request accepted by GitHub.' }, { status: 202 });
  }

  // For GET requests that might return no content (e.g. an empty list of runs for a workflow)
  // GitHub usually returns 200 with an empty array/object, not 204 for list endpoints.
  // A specific GET for a resource that doesn't exist would be a 404 (handled by !response.ok).
  // If a GET endpoint *could* return 204, this handles it by providing null data.
  if (response.status === 204) {
    return NextResponse.json(null, { status: 204 });
  }
  
  // For other successful GETs (typically 200 with data)
  try {
    const rawData = await response.json();
    return NextResponse.json({ rawData, status: response.status, ok: true }, { status: response.status });
  } catch (e: any) {
    // If response.json() fails (e.g. empty body but status 200, or malformed JSON from GitHub)
    console.error(`Failed to parse JSON response from GitHub for URL ${url}. Status: ${response.status}`, e.message);
    return NextResponse.json({ message: 'Failed to parse response from GitHub.' }, { status: 502 }); // Bad Gateway
  }
}

// Define simplified types for frontend responses
interface SimpleRun {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
  // jobs_url is intentionally omitted, client will use jobsForRunId query
}

interface SimpleJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
}

export async function GET(request: NextRequest) {
  const session = await validateSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  if (!GITHUB_TOKEN) {
    console.error('GitHub token not configured on the server.');
    return NextResponse.json({ message: 'Server configuration error: GitHub token missing.' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const runIdParam = searchParams.get('runId');
  const jobsForRunIdParam = searchParams.get('jobsForRunId');
  const workflowStatusFilter = searchParams.get('status');
  const perPage = searchParams.get('per_page') || '30';

  let urlToFetch: string;
  let transformFunction: (data: any) => any;

  if (runIdParam) {
    urlToFetch = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${runIdParam}`;
    transformFunction = (data: any): SimpleRun | null => data ? ({
      id: data.id,
      name: data.name,
      status: data.status,
      conclusion: data.conclusion,
      created_at: data.created_at,
      updated_at: data.updated_at,
      html_url: data.html_url,
      run_number: data.run_number,
    }) : null;
  } else if (jobsForRunIdParam) {
    urlToFetch = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${jobsForRunIdParam}/jobs`;
    transformFunction = (data: any): { jobs: SimpleJob[] } | null => data && Array.isArray(data.jobs) ? ({
      jobs: data.jobs.map((job: any) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
      })),
    }) : { jobs: [] };
  } else {
    urlToFetch = `https://api.github.com/repos/${ORG}/${REPO}/actions/workflows/${WORKFLOW_FILE_NAME}/runs?per_page=${perPage}`;
    if (workflowStatusFilter) {
      urlToFetch += `&status=${workflowStatusFilter}`;
    }
    transformFunction = (data: any): { workflow_runs: SimpleRun[] } | null => data && Array.isArray(data.workflow_runs) ? ({
      workflow_runs: data.workflow_runs.map((run: any) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        updated_at: run.updated_at,
        html_url: run.html_url,
        run_number: run.run_number,
      })),
    }) : { workflow_runs: [] };
  }

  const result = await fetchFromGitHub(urlToFetch);

  // If fetchFromGitHub returned a NextResponse, it's an error response 
  // or a specific non-GET success response that it decided to handle fully.
  if (result instanceof NextResponse) {
    return result;
  }

  // At this point, result MUST be of type { rawData: any; status: number; ok: boolean; }
  // and result.ok should be true.
  let resultAny: any = result;
  
  if (resultAny instanceof NextResponse) {
    return resultAny;
  }

  // At this point, result MUST be of type { rawData: any; status: number; ok: boolean; }
  // and result.ok should be true.
  if (!resultAny.rawData.ok) {
    // This case should ideally not be hit if fetchFromGitHub's logic for ok:true is sound,
    // but as a safeguard if ok somehow became false without returning a NextResponse.
    console.error("fetchFromGitHub returned ok:false without a NextResponse:", result);
    return NextResponse.json({ message: 'Internal error processing GitHub data (unexpected ok:false).' }, { status: 500 });
  }
  
  // result.rawData could be null if GitHub returned 204 and fetchFromGitHub passed it as such.
  // The transformFunctions are expected to handle null rawData gracefully.
  const transformedData = transformFunction(resultAny.rawData);
  return NextResponse.json(transformedData, { status: resultAny.rawData.status });
}

export async function POST(request: NextRequest) {
  const session = await validateSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  if (!GITHUB_TOKEN) {
    console.error('GitHub token not configured on the server.');
    return NextResponse.json({ message: 'Server configuration error: GitHub token missing.' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const cancelRunId = searchParams.get('cancelRunId');

  if (cancelRunId) {
    const url = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${cancelRunId}/cancel`;
    // For POST actions like cancel, we might not need to transform the response significantly
    // GitHub returns 202 Accepted for a successful cancel request.
    // Our fetchFromGitHub will return a NextResponse for this.
    const cancelAttemptResponse = await fetchFromGitHub(url, { method: 'POST' });
    
    // Pass through the response from fetchFromGitHub (should be a NextResponse)
    return cancelAttemptResponse;
  }

  return NextResponse.json({ message: 'Invalid action for POST request. Specify cancelRunId parameter.' }, { status: 400 });
}