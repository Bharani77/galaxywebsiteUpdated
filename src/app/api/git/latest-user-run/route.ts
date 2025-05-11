import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { 
  fetchFromGitHub, 
  GitHubRun, 
  GitHubJob, 
  GitHubWorkflowRunsResponse, 
  GitHubRunJobsResponse 
} from '@/lib/githubApiUtils';

const ORG = process.env.NEXT_PUBLIC_GITHUB_ORG || 'GalaxyKickLock';
const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'GalaxyKickPipeline';
const WORKFLOW_FILE_NAME = process.env.NEXT_PUBLIC_GITHUB_WORKFLOW_FILE || 'blank.yml';

interface ClientSafeRunResponse { // Fields adjusted
  runId: number;
  status: string | null;
  conclusion: string | null;
  jobName: string; // Essential for client logic
  // createdAt: string; // To be removed
  // htmlUrl: string; // To be removed
}

export async function GET(request: NextRequest) {
  const session = await validateSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error('Critical: GitHub token not configured on the server for latest-user-run.');
    return NextResponse.json({ message: 'Server configuration error: Required integration token missing.' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const logicalUsername = searchParams.get('logicalUsername');

  if (!logicalUsername) {
    return NextResponse.json({ message: 'Missing logicalUsername query parameter.' }, { status: 400 });
  }

  const targetJobName = `Run for ${logicalUsername}`;
  console.log(`Searching for latest run with job name: "${targetJobName}"`);

  try {
    // 1. Fetch recent workflow runs (e.g., last 30, sorted by creation by default by GitHub API)
    // We can fetch more if needed, but 30 is a good start.
    // GitHub API sorts by created_at descending by default for workflow runs.
    const runsEndpoint = `/repos/${ORG}/${REPO}/actions/workflows/${WORKFLOW_FILE_NAME}/runs?per_page=30`;
    const runsResult = await fetchFromGitHub(runsEndpoint);

    if (!runsResult.ok) {
      // runsResult is already a NextResponse containing the error
      console.error(`Failed to fetch workflow runs. Status: ${runsResult.status}`);
      return runsResult; 
    }

    const runsResponse = await runsResult.json() as GitHubWorkflowRunsResponse;
    if (!runsResponse.workflow_runs || runsResponse.workflow_runs.length === 0) {
      console.log(`No workflow runs found for ${WORKFLOW_FILE_NAME} (ORG: ${ORG}, REPO: ${REPO}).`); // Keep server log specific
      return NextResponse.json({ message: `No recent background processes found.` }, { status: 404 }); // Generic client message
    }

    // The runs are already sorted newest first by the GitHub API.
    for (const run of runsResponse.workflow_runs) {
      // 2. For each run, fetch its jobs
      // Adding a small delay as jobs might not be immediately available after run creation.
      // This might be more critical if we were triggering and then immediately checking.
      // For existing runs, it's less of an issue but doesn't hurt.
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay

      const jobsEndpoint = `/repos/${ORG}/${REPO}/actions/runs/${run.id}/jobs`;
      const jobsResult = await fetchFromGitHub(jobsEndpoint);

      if (!jobsResult.ok) {
        // jobsResult is already a NextResponse containing the error
        console.warn(`Could not fetch jobs for run ${run.id}, skipping. Status: ${jobsResult.status}`);
        // Optionally, parse jobsResult.json() if you want to log a specific message from its body
        // For now, just log status and continue.
        continue; 
      }
      
      const jobsData = await jobsResult.json() as GitHubRunJobsResponse;
      if (jobsData.jobs && jobsData.jobs.length > 0) {
        const matchingJob = jobsData.jobs.find(job => job.name === targetJobName);
        if (matchingJob) {
          // Server log can remain specific
          console.log(`Found matching job in run ${run.id}. Job ID: ${matchingJob.id}, Job Name: ${matchingJob.name}, Status: ${run.status}, Conclusion: ${run.conclusion}`);
          // Construct a client-safe response
          const clientResponsePayload: ClientSafeRunResponse = {
            runId: run.id,
            status: run.status,
            conclusion: run.conclusion,
            jobName: matchingJob.name, // Client needs this for logic
            // createdAt and htmlUrl are omitted
          };
          return NextResponse.json(clientResponsePayload, { status: 200 });
        }
      }
    }

    // If loop completes, no matching run was found
    console.log(`No runs found with a job named "${targetJobName}" after checking all runs.`); // Keep server log specific
    return NextResponse.json({ message: `No matching task found for your request.` }, { status: 404 }); // Generic client message

  } catch (error: any) {
    console.error('Error in latest-user-run endpoint:', error);
    return NextResponse.json({ message: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
