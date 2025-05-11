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
    // These are in `session.deployTimestamp` and `session.activeFormNumber`.

    if (session.deployTimestamp && session.activeFormNumber) {
      const success = await updateUserDeployStatus(
        session.userId,
        session.deployTimestamp, // Pass current timestamp
        session.activeFormNumber, // Pass current form number
        runId // The new runId to set
      );

      if (success) {
        return NextResponse.json({ message: 'Active run ID updated successfully.' });
      } else {
        return NextResponse.json({ message: 'Failed to update active run ID.' }, { status: 500 });
      }
    } else {
      // This case means a run ID is being set, but there's no active deployment record (timestamp/form number)
      // This might be an inconsistent state or a specific logic path.
      // For now, let's assume this is an error or needs specific handling.
      console.warn(`User ${session.userId} trying to set runId ${runId} but no active deployTimestamp/activeFormNumber in session.`);
      return NextResponse.json({ message: 'Cannot set run ID without an active deployment record (timestamp/form number missing from session).' }, { status: 409 });
    }

  } catch (error: any) {
    console.error('Error in set-active-run API route:', error.message);
    return NextResponse.json({ message: 'Internal server error.', error: error.message }, { status: 500 });
  }
}
