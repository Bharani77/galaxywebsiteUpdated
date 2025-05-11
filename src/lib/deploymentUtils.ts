import { SupabaseClient } from '@supabase/supabase-js';
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
  supabaseService: SupabaseClient
): Promise<{ success: boolean; message: string }> {
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
        await updateUserDeployStatus(userId, null, null);
        console.log(`[ServerUndeploy] Cleared deploy status in Supabase for user ${userId}.`);
        return { success: true, message: 'Undeploy successful and database updated.' };
      } else {
        console.error(`[ServerUndeploy] Failed to send stop command to loca.lt for user ${userId}. Status: ${undeployResponse.status}, Text: ${await undeployResponse.text()}`);
        // Even if loca.lt fails, clear DB status to prevent inconsistent state or repeated attempts on stale data.
        await updateUserDeployStatus(userId, null, null);
        return { success: false, message: `Failed to contact deployment service (status: ${undeployResponse.status}). Deployment status in DB has been cleared.` };
      }
    } catch (e: any) {
      console.error(`[ServerUndeploy] Network error or exception during loca.lt fetch for undeploy (user ${userId}):`, e.message);
      await updateUserDeployStatus(userId, null, null);
      return { success: false, message: `Network error during undeploy attempt: ${e.message}. Deployment status in DB has been cleared.` };
    }
  } else {
    console.log(`[ServerUndeploy] No active deployment found (based on provided timestamps/formNumber) for user ${userId} to undeploy.`);
    // If there was nothing to undeploy according to DB, this is not a failure of the undeploy process itself.
    return { success: true, message: 'No active deployment information found to perform undeploy.' };
  }
}
