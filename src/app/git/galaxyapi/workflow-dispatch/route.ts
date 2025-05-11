import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth'; // Assuming @/ is configured for src/

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Server-side environment variable
const ORG = process.env.NEXT_PUBLIC_GITHUB_ORG || 'GalaxyKickLock';
const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'GalaxyKickPipeline';
const WORKFLOW_FILE_NAME = process.env.NEXT_PUBLIC_GITHUB_WORKFLOW_FILE || 'blank.yml';

export async function POST(request: NextRequest) {
  const session = await validateSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }
  // You can use session.userId or session.username if needed for logging or other logic

  if (!GITHUB_TOKEN) {
    console.error('GitHub token not configured on the server.');
    return NextResponse.json({ message: 'Server configuration error: GitHub token missing.' }, { status: 500 });
  }

  try {
    const body = await request.json(); 
    const workflowInputUsername = body.username; // Use username from request body, sent by GalaxyForm

    if (!workflowInputUsername) {
      // This case means GalaxyForm didn't send it, or it was empty.
      console.error('Username not provided in request body for workflow dispatch.');
      return NextResponse.json({ message: 'Username is required in request body.' }, { status: 400 });
    }

    const apiHeaders = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `token ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };

    const dispatchUrl = `https://api.github.com/repos/${ORG}/${REPO}/actions/workflows/${WORKFLOW_FILE_NAME}/dispatches`;
    
    const githubResponse = await fetch(dispatchUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ ref: 'main', inputs: { username: workflowInputUsername } }),
    });

    if (githubResponse.status === 204) {
      // A 204 No Content response should not have a body.
      return new NextResponse(null, { status: 204 });
    } else {
      const errorData = await githubResponse.text(); // Use text() first to avoid JSON parse error if response is not JSON
      console.error(`GitHub API error: ${githubResponse.status} for ${dispatchUrl}`, errorData);
      try {
        const jsonData = JSON.parse(errorData); // Try to parse as JSON
        return NextResponse.json({ message: 'Failed to dispatch workflow.', error: jsonData }, { status: githubResponse.status });
      } catch (e) {
        return NextResponse.json({ message: 'Failed to dispatch workflow.', error: errorData }, { status: githubResponse.status });
      }
    }
  } catch (error: any) {
    console.error('Error in workflow dispatch API route:', error);
    return NextResponse.json({ message: 'Internal server error.', error: error.message }, { status: 500 });
  }
}
