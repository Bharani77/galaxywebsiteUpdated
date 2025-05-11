import { NextRequest, NextResponse } from 'next/server';
import { validateSession, updateUserDeployStatus } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await validateSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { runId } = await request.json();
    if (!runId) {
      return NextResponse.json({ message: 'Missing runId parameter.' }, { status: 400 });
    }

    // We need to pass the current deployTimestamp and activeFormNumber
    // If they are not available in the session, this update is problematic
    // as updateUserDeployStatus might clear them if not passed.
    // This implies that when a run becomes active, these should already be known.
    // For now, let's assume they are part of the validated session,
    // or this endpoint is called when they are confirmed.
    // A better approach might be for the client to send them if they are known.

    // Critical: updateUserDeployStatus expects current deployTimestamp and activeFormNumber
    // to persist them. If we only want to update runId, this needs care.
    // The current updateUserDeployStatus will set timestamp and formNumber to null if not provided.
    // This is not what we want here. We only want to set/update active_run_id.

    // Let's re-fetch user to get current deploy_timestamp and active_form_number
    // This is inefficient. A dedicated function to only update run_id would be better.
    // For now, we stick to updateUserDeployStatus.
    // This means the client *must* have called updateUserDeployStatus with timestamp and formNumber *before* this.
    // And this call is just to add the runId.

    // The UserSession interface might not have runId.
    // We are setting it based on client discovering it.
    // The `updateUserDeployStatus` function was modified to accept activeRunId.
    // It will preserve existing deployTimestamp and activeFormNumber if they are not passed as null.
    // However, the signature is (userId, timestamp | null, formNum | null, runId | null)
    // To *only* update runId, we'd need to pass the *current* timestamp and formNum.
    // When a GitHub run becomes active, this endpoint is called.
    // We should set the deploy_timestamp to now, and active_form_number to a general value (e.g., 0 or null)
    // if it represents the main GitHub deployment, not a specific Kick 1-5 service.
    // For simplicity, let's use null for active_form_number if it's just the main deployment.
    // The client (GalaxyForm) determines the runId when its main deployment becomes active.

    const newDeployTimestamp = new Date().toISOString();
    // Assuming active_form_number can be null for the main GitHub deployment context
    // Or use a convention like 0 if null is not appropriate for your DB/logic.
    // Let's use null for active_form_number to indicate it's the overall deployment.
    const formNumberForMainDeployment = null; 

    const success = await updateUserDeployStatus(
      session.userId,
      newDeployTimestamp,
      formNumberForMainDeployment, 
      runId // The new runId to set
    );

    if (success) {
      return NextResponse.json({ message: 'Active deployment details (including run ID) updated successfully.' });
    } else {
      return NextResponse.json({ message: 'Failed to update active deployment details.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error in set-active-run API route:', error.message);
    return NextResponse.json({ message: 'Internal server error.', error: error.message }, { status: 500 });
  }
}
