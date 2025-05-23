import { SupabaseClient, createClient } from '@supabase/supabase-js'; // Import createClient
import { updateUserDeployStatus } from '@/lib/auth'; 
import { fetchFromGitHub, GitHubRun } from '@/lib/githubApiUtils'; // Import for direct GitHub API calls

// Constants for GitHub API, mirroring those in /git/galaxyapi/runs/route.ts
const GITHUB_ORG = process.env.NEXT_PUBLIC_GITHUB_ORG || 'GalaxyKickLock';
const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'GalaxyKickPipeline';

/**
 * Generates the logical username for loca.lt services.
 * @param user An object containing the plain username.
 * @returns The logical username string.
 */
export function getLogicalUsername(user: { username: string }): string {
  if (!user || !user.username) {
    // Fallback or error if username is not provided, though callers should ensure it.
    console.error('[getLogicalUsername] Username is missing.');
    return 'invalid_user_7890'; 
  }
  return `${user.username}7890`;
}

/**
 * Performs a server-side undeploy operation for a user.
 * This includes calling the loca.lt stop endpoint and updating Supabase.
 * @param userId The ID of the user.
 * @param usernameForLogical The plain username (for generating logical username).
 * @param deployTimestamp The timestamp of the current deployment.
 * @param activeFormNumber The active form number of the current deployment.
 * @param supabaseService The Supabase service client instance.
 * @returns A promise that resolves to an object indicating success and a message.
 */
export async function performServerSideUndeploy(
  userId: string,
  usernameForLogical: string,
  deployTimestamp: string | null | undefined,
  activeFormNumber: number | null | undefined,
  activeRunId?: number | string | null, // Made activeRunId optional for calls not having it (like beacon)
  supabaseService?: SupabaseClient // Make supabaseService optional if it can create its own
): Promise<{ success: boolean; message: string }> {

  // Ensure Supabase client is available
  let SClient = supabaseService; // Renamed to avoid conflict with 'client' if it's a global/module var
  if (!SClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[ServerUndeploy] Supabase client cannot be initialized (missing URL or Service Key).');
      return { success: false, message: 'Server configuration error for undeploy.' };
    }
    SClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  let locaLtStopSuccess = true; // Assume success if no loca.lt stop is needed or if it succeeds
  let locaLtMessage = "No loca.lt service stop required or attempted.";

  // Attempt to stop loca.lt service ONLY if activeFormNumber is present and valid
  if (deployTimestamp && activeFormNumber && activeFormNumber > 0) { // Assuming form numbers are > 0
    const logicalUsername = getLogicalUsername({ username: usernameForLogical });
    if (logicalUsername.startsWith('invalid_user_')) {
      console.error(`[ServerUndeploy] Cannot stop loca.lt for user ${userId}: username missing.`);
      // This is a partial failure; GitHub Action might still be processed if activeRunId is present.
      locaLtStopSuccess = false;
      locaLtMessage = 'Failed to stop loca.lt service: Username missing.';
    } else {
      const stopLocaltUrl = `https://${logicalUsername}.loca.lt/stop/${activeFormNumber}`;
      console.log(`[ServerUndeploy] Attempting to stop loca.lt service for user ${userId} (${usernameForLogical}) at ${stopLocaltUrl}`);
      try {
        const undeployResponse = await fetch(stopLocaltUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true', 'User-Agent': 'GalaxyApp/1.0 (ServerSideUndeploy)' },
          body: JSON.stringify({}),
        });
        if (undeployResponse.ok) {
          console.log(`[ServerUndeploy] Successfully sent stop command to loca.lt for user ${userId}, form ${activeFormNumber}.`);
          locaLtMessage = `loca.lt service for form ${activeFormNumber} stop command sent.`;
        } else {
          locaLtStopSuccess = false;
          const errorText = await undeployResponse.text();
          locaLtMessage = `Failed to send stop command to loca.lt (form ${activeFormNumber}): ${undeployResponse.status} ${errorText}`;
          console.error(`[ServerUndeploy] ${locaLtMessage}`);
        }
      } catch (e: any) {
        locaLtStopSuccess = false;
        locaLtMessage = `Network error stopping loca.lt (form ${activeFormNumber}): ${e.message}`;
        console.error(`[ServerUndeploy] ${locaLtMessage}`);
      }
    }
  }

  // Attempt to cancel GitHub Actions run if activeRunId is provided, without polling.
  let githubCancelSuccess = true;
  let githubCancelMessage = "No GitHub Action cancellation required or attempted.";

  if (activeRunId) {
    console.log(`[ServerUndeploy] Active run ID ${activeRunId} found. Attempting to request cancellation via GitHub API.`);
    const cancelEndpoint = `/repos/${GITHUB_ORG}/${GITHUB_REPO}/actions/runs/${activeRunId}/cancel`;
    try {
      const cancelApiResponse = await fetchFromGitHub(cancelEndpoint, { method: 'POST' });
      if (cancelApiResponse.ok || cancelApiResponse.status === 202) { // 202 Accepted is success for cancel
        console.log(`[ServerUndeploy] GitHub API request to cancel run ${activeRunId} sent successfully (Status: ${cancelApiResponse.status}).`);
        githubCancelMessage = `GitHub Action run ${activeRunId} cancellation request sent.`;
      } else {
        githubCancelSuccess = false;
        const errorText = await cancelApiResponse.text().catch(() => `Status ${cancelApiResponse.status}`);
        githubCancelMessage = `Failed to send cancellation request for GitHub run ${activeRunId}: ${cancelApiResponse.status} ${errorText}.`;
        console.error(`[ServerUndeploy] ${githubCancelMessage}`);
      }
    } catch (cancelError: any) {
      githubCancelSuccess = false;
      githubCancelMessage = `Exception calling GitHub API to cancel run ${activeRunId}: ${cancelError.message}.`;
      console.error(`[ServerUndeploy] ${githubCancelMessage}`);
    }
  }

  // After all operations, clear the user's deployment status in DB
  await updateUserDeployStatus(userId, null, null, null); // Clear timestamp, formNumber, and runId
  console.log(`[ServerUndeploy] Cleared all deployment fields (timestamp, form, runId) in Supabase for user ${userId}.`);

  const overallSuccess = locaLtStopSuccess && githubCancelSuccess; // Use githubCancelSuccess
  const finalMessage = `loca.lt: ${locaLtMessage} GitHub: ${githubCancelMessage} DB status cleared.`; // Use githubCancelMessage

  if (overallSuccess) {
    return { success: true, message: finalMessage };
  } else {
    // If either part failed but we proceeded, it's a partial success from a "cleared DB" perspective
    // but a failure from "ensured everything undeployed cleanly" perspective.
    // The caller (signin route) will decide if this is acceptable.
    return { success: false, message: `Undeploy partially failed. ${finalMessage}` };
  }
}
