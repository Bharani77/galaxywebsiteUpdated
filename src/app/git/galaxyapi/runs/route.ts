import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { 
  fetchFromGitHub, 
  GitHubRun, 
  GitHubJob,
  GitHubWorkflowRunsResponse,
  GitHubRunJobsResponse
} from '@/lib/githubApiUtils';

// Environment variables will be read by githubApiUtils or passed if needed
const ORG = process.env.NEXT_PUBLIC_GITHUB_ORG || 'GalaxyKickLock';
const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'GalaxyKickPipeline';
const WORKFLOW_FILE_NAME = process.env.NEXT_PUBLIC_GITHUB_WORKFLOW_FILE || 'blank.yml';

// Simplified types for frontend responses, can be adjusted if GitHubRun/Job are directly usable
interface SimpleRun {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
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

  // GITHUB_TOKEN check is handled by fetchFromGitHub via getGitHubApiHeaders
  // but good to have a high-level check or ensure it's caught by the util.
  if (!process.env.GITHUB_TOKEN) {
    console.error('Critical: GitHub token not configured on the server.');
    return NextResponse.json({ message: 'Server configuration error: GitHub token missing.' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const runIdParam = searchParams.get('runId');
  const jobsForRunIdParam = searchParams.get('jobsForRunId');
  const workflowStatusFilter = searchParams.get('status');
  const perPage = searchParams.get('per_page') || '30'; // Default to 30, can be overridden

  let endpoint: string;
  let transformFunction: (data: any) => any; // Keep transform function for now

  if (runIdParam) {
    endpoint = `/repos/${ORG}/${REPO}/actions/runs/${runIdParam}`;
    transformFunction = (ghRun: GitHubRun): SimpleRun | null => ghRun ? ({
      id: ghRun.id,
      name: ghRun.name,
      status: ghRun.status,
      conclusion: ghRun.conclusion,
      created_at: ghRun.created_at,
      updated_at: ghRun.updated_at,
      html_url: ghRun.html_url,
      run_number: ghRun.run_number,
    }) : null;
  } else if (jobsForRunIdParam) {
    // The delay is still relevant if GitHub needs time to populate jobs after a run starts
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay
    endpoint = `/repos/${ORG}/${REPO}/actions/runs/${jobsForRunIdParam}/jobs`;
    transformFunction = (ghJobsResponse: GitHubRunJobsResponse): { jobs: SimpleJob[] } => ({
      jobs: ghJobsResponse && Array.isArray(ghJobsResponse.jobs) 
        ? ghJobsResponse.jobs.map((job: GitHubJob) => ({
            id: job.id,
            name: job.name,
            status: job.status,
            conclusion: job.conclusion,
          }))
        : [],
    });
  } else {
    endpoint = `/repos/${ORG}/${REPO}/actions/workflows/${WORKFLOW_FILE_NAME}/runs?per_page=${perPage}`;
    if (workflowStatusFilter) {
      endpoint += `&status=${workflowStatusFilter}`;
    }
    transformFunction = (ghRunsResponse: GitHubWorkflowRunsResponse): { workflow_runs: SimpleRun[] } => ({
      workflow_runs: ghRunsResponse && Array.isArray(ghRunsResponse.workflow_runs)
        ? ghRunsResponse.workflow_runs.map((run: GitHubRun) => ({
            id: run.id,
            name: run.name,
            status: run.status,
            conclusion: run.conclusion,
            created_at: run.created_at,
            updated_at: run.updated_at,
            html_url: run.html_url,
            run_number: run.run_number,
          }))
        : [],
    });
  }

  // Retry logic can be simplified or made part of fetchFromGitHub if it's a common pattern
  // For now, keeping it here to illustrate the change.
  let result: any;
  let attempts = 0;
  const maxAttempts = 3; // Reduced max attempts for brevity, adjust as needed
  const retryInterval = 10000; // 10 seconds

  let apiResponse: NextResponse | null = null;
  let rawData: any = null;

  do {
    attempts++;
    apiResponse = await fetchFromGitHub(endpoint);

    if (apiResponse.ok) {
      try {
        rawData = await apiResponse.json(); // Extract JSON data if response is OK
        break; // Successful fetch and parse
      } catch (e) {
        console.error(`Attempt ${attempts}: Failed to parse JSON response from GitHub. Status: ${apiResponse.status}`, e);
        // Treat JSON parse error as a fetch failure for retry purposes
        apiResponse = NextResponse.json({ message: 'Failed to parse GitHub response.' }, { status: 502 }); // Override apiResponse to indicate error
      }
    }

    // If not ok, or JSON parsing failed, apiResponse holds the error NextResponse
    if (attempts >= maxAttempts) {
      console.error(`Final attempt ${attempts} failed. Status: ${apiResponse.status}`);
      return apiResponse; // Return the error response from last attempt
    }

    // Check if status is retryable (e.g., 500, 502, 503, 504)
    const retryableStatuses = [500, 502, 503, 504];
    if (!retryableStatuses.includes(apiResponse.status)) {
      console.log(`Attempt ${attempts} failed with non-retryable status ${apiResponse.status}.`);
      return apiResponse; // Return the error response
    }

    console.log(`Attempt ${attempts} failed with status ${apiResponse.status}. Retrying in ${retryInterval / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, retryInterval));

  } while (attempts < maxAttempts);

  if (!apiResponse || !apiResponse.ok) {
    // This case should ideally be caught by the loop's exit conditions (maxAttempts or non-retryable status)
    console.error("All attempts failed to fetch data from GitHub or last attempt was not ok.");
    return apiResponse || NextResponse.json({ message: 'Failed to fetch data from GitHub after multiple attempts.' }, { status: 500 });
  }
  
  // rawData should be populated if apiResponse.ok was true and JSON parsing succeeded
  const transformedData = transformFunction(rawData);
  // Use the status from the successful apiResponse
  return NextResponse.json(transformedData, { status: apiResponse.status });
}

export async function POST(request: NextRequest) {
  const session = await validateSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }
  if (!process.env.GITHUB_TOKEN) {
    console.error('Critical: GitHub token not configured on the server.');
    return NextResponse.json({ message: 'Server configuration error: GitHub token missing.' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const cancelRunId = searchParams.get('cancelRunId');

  if (cancelRunId) {
    const endpoint = `/repos/${ORG}/${REPO}/actions/runs/${cancelRunId}/cancel`;
    const cancelAttemptResponse = await fetchFromGitHub(endpoint, { method: 'POST' });
    
    // fetchFromGitHub now returns a NextResponse directly for POSTs that it handles (like 202)
    // or for errors.
    return cancelAttemptResponse;
  }

  return NextResponse.json({ message: 'Invalid action for POST request. Specify cancelRunId parameter.' }, { status: 400 });
}
