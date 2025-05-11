import { NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// These are already defined in your runs/route.ts, ensure they are consistently available
// For a library, it might be better to pass them as arguments or have a config object
// For now, assuming they are accessible as process.env here as well, or they will be passed.
// Let's define them here for clarity, ensure your .env.local or environment setup has them.
const ORG = process.env.NEXT_PUBLIC_GITHUB_ORG || 'GalaxyKickLock';
const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'GalaxyKickPipeline';
// WORKFLOW_FILE_NAME is used when listing runs for a specific workflow.

export const GITHUB_API_BASE_URL = 'https://api.github.com';

export const getGitHubApiHeaders = (): Record<string, string> => {
  if (!GITHUB_TOKEN) {
    // This message will be part of the error returned to client if this throw is caught by fetchFromGitHub
    throw new Error('Automation service token not configured on the server.');
  }
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `token ${GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
};

export async function fetchFromGitHub(
  endpoint: string, // e.g., /repos/{ORG}/{REPO}/actions/runs
  options: RequestInit = {},
  baseUrl: string = GITHUB_API_BASE_URL
) {
  let headers;
  try {
    headers = getGitHubApiHeaders();
  } catch (error: any) {
    console.error(error.message);
    return NextResponse.json({ message: `Server configuration error: ${error.message}` }, { status: 500 });
  }

  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`GitHub API error: ${response.status} for URL ${url}`, errorData.substring(0, 500)); // Log snippet
    try {
      const jsonData = JSON.parse(errorData);
      // Generic client message
      return NextResponse.json({ message: `Automation service API Error: ${response.status}`, error: jsonData }, { status: response.status });
    } catch (e) {
      // Generic client message
      return NextResponse.json({ message: `Automation service API Error: ${response.status}`, error: errorData }, { status: response.status });
    }
  }

  if (options.method === 'POST' && response.status === 202) { // e.g. cancel run
    return NextResponse.json({ message: 'Request accepted by the automation service.' }, { status: 202 });
  }
  if (options.method === 'POST' && response.status === 204) { // e.g. workflow dispatch
    return NextResponse.json({ message: 'Workflow dispatched successfully.' }, { status: 204 });
  }

  if (response.status === 204) { // No content for GET
    return NextResponse.json(null, { status: 204 });
  }

  try {
    const rawData = await response.json();
    // Always return a NextResponse
    return NextResponse.json(rawData, { status: response.status });
  } catch (e: any) {
    console.error(`Failed to parse JSON response from the automation service for URL ${url}. Status: ${response.status}`, e.message);
    // Always return a NextResponse for errors too
    // Generic client message
    return NextResponse.json({ message: 'Failed to parse response from the automation service.' }, { status: 502 });
  }
}

// Define shared interfaces for GitHub API responses (can be expanded)
export interface GitHubRun {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
  jobs_url: string;
  workflow_id: number;
}

export interface GitHubJob {
  id: number;
  run_id: number;
  name: string;
  status: string; // "queued", "in_progress", "completed"
  conclusion: string | null; // "success", "failure", "neutral", "cancelled", "skipped", "timed_out", "action_required"
  html_url: string;
  started_at: string;
  completed_at: string | null;
}

export interface GitHubWorkflowRunsResponse {
  total_count: number;
  workflow_runs: GitHubRun[];
}

export interface GitHubRunJobsResponse {
  total_count: number;
  jobs: GitHubJob[];
}
