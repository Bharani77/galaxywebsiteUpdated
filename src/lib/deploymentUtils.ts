import { SupabaseClient, createClient } from '@supabase/supabase-js'; // Import createClient
import { updateUserDeployStatus } from '@/lib/auth'; // Assuming updateUserDeployStatus is exported from auth

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
  let client = supabaseService;
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[ServerUndeploy] Supabase client cannot be initialized (missing URL or Service Key).');
      return { success: false, message: 'Server configuration error for undeploy.' };
    }
    client = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  if (deployTimestamp && activeFormNumber) {
    const logicalUsername = getLogicalUsername({ username: usernameForLogical });
    
    // Check if logicalUsername was successfully generated (it includes a check for usernameForLogical presence)
    if (logicalUsername.startsWith('invalid_user_')) {
        console.error(`[ServerUndeploy] Could not perform undeploy for user ${userId} due to missing username.`);
        // We might still want to clear DB status if we have a userId
        if (userId) {
            await updateUserDeployStatus(userId, null, null);
            console.log(`[ServerUndeploy] Cleared deploy status in Supabase for user ${userId} despite missing username for loca.lt call.`);
        }
        return { success: false, message: 'Cannot undeploy: User details incomplete (username missing).' };
    }

    const stopLocaltUrl = `https://${logicalUsername}.loca.lt/stop/${activeFormNumber}`;
    console.log(`[ServerUndeploy] Attempting undeploy for user ${userId} (${usernameForLogical}) at ${stopLocaltUrl}`);
    
    try {
      // Consider adding a timeout to this fetch call
      const undeployResponse = await fetch(stopLocaltUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true', // Standard header for loca.lt
          'User-Agent': 'GalaxyApp/1.0 (ServerSideUndeploy)',
        },
        body: JSON.stringify({}), // Empty body is typical for stop actions
      });

      if (undeployResponse.ok) {
        console.log(`[ServerUndeploy] Successfully sent stop command to loca.lt for user ${userId}, form ${activeFormNumber}.`);
        
        // If activeRunId is provided, attempt to poll GitHub Actions for cancellation
        if (activeRunId) {
          console.log(`[ServerUndeploy] Polling GitHub for cancellation of run ID: ${activeRunId}`);
          const pollTimeout = 60 * 1000; // 1 minute timeout for polling
          const pollInterval = 5 * 1000; // 5 seconds interval
          let pollStartTime = Date.now();
          let runCancelled = false;

          while (Date.now() - pollStartTime < pollTimeout) {
            try {
              // Construct the absolute URL for the API route
              const currentUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'); // Fallback for local
              const runsApiUrl = new URL(`/git/galaxyapi/runs?runId=${activeRunId}`, currentUrl);
              
              const ghResponse = await fetch(runsApiUrl.toString(), {
                method: 'GET', // Assuming GET to fetch run status
                headers: { 'Content-Type': 'application/json' }, // Add any necessary auth if this API is protected
              });

              if (ghResponse.ok) {
                const runDetails = await ghResponse.json();
                if (runDetails.status === 'completed' && runDetails.conclusion === 'cancelled') {
                  console.log(`[ServerUndeploy] Run ID ${activeRunId} confirmed cancelled on GitHub.`);
                  runCancelled = true;
                  break;
                } else if (runDetails.status === 'completed') {
                  console.log(`[ServerUndeploy] Run ID ${activeRunId} completed with conclusion: ${runDetails.conclusion} (not cancelled).`);
                  break; // Stop polling if completed but not cancelled
                }
                // Continue polling if still in progress or queued
              } else {
                console.warn(`[ServerUndeploy] Error fetching GitHub run status for ${activeRunId}: ${ghResponse.status}. Will retry.`);
              }
            } catch (ghError: any) {
              console.error(`[ServerUndeploy] Exception during GitHub run status poll for ${activeRunId}: ${ghError.message}. Will retry.`);
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }

          if (!runCancelled && (Date.now() - pollStartTime >= pollTimeout)) {
            console.warn(`[ServerUndeploy] Timed out waiting for GitHub run ${activeRunId} to be cancelled.`);
            // Proceed to clear DB status anyway
          }
        } else {
          console.log(`[ServerUndeploy] No activeRunId provided, skipping GitHub poll. Proceeding to clear DB status.`);
        }
        
        await updateUserDeployStatus(userId, null, null, null); // Clear timestamp, formNumber, and runId
        console.log(`[ServerUndeploy] Cleared deploy status (timestamp, form, runId) in Supabase for user ${userId}.`);
        return { success: true, message: 'Undeploy command sent and database status cleared. GitHub poll attempted if run ID was available.' };

      } else {
        console.error(`[ServerUndeploy] Failed to send stop command to loca.lt for user ${userId}. Status: ${undeployResponse.status}, Text: ${await undeployResponse.text()}`);
        await updateUserDeployStatus(userId, null, null, null); // Clear DB status
        return { success: false, message: `Failed to contact deployment service (status: ${undeployResponse.status}). Deployment status in DB has been cleared.` };
      }
    } catch (e: any) {
      console.error(`[ServerUndeploy] Network error or exception during loca.lt fetch for undeploy (user ${userId}):`, e.message);
      await updateUserDeployStatus(userId, null, null, null); // Clear DB status
      return { success: false, message: `Network error during undeploy attempt: ${e.message}. Deployment status in DB has been cleared.` };
    }
  } else {
    console.log(`[ServerUndeploy] No active deployment found (based on provided timestamps/formNumber) for user ${userId} to undeploy.`);
    // If there was nothing to undeploy according to DB, this is not a failure of the undeploy process itself.
    return { success: true, message: 'No active deployment information found to perform undeploy.' };
  }
}
