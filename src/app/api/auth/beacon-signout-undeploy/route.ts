import { NextRequest, NextResponse } from 'next/server';
import { validateSession, UserSession, updateUserDeployStatus } from '@/lib/auth'; // Assuming @/ is configured for src/
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Initialize Supabase client directly if not already exported or if specific instance needed
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Helper function to get the logical username (copied from localt/action/route.ts)
// Ensure this is consistent if it changes elsewhere
function getLogicalUsername(session: UserSession): string {
  return `${session.username}7890`; 
}

export async function POST(request: NextRequest) {
  // navigator.sendBeacon sends data as 'application/x-www-form-urlencoded', 'multipart/form-data', or 'text/plain'
  // It's simpler to not rely on a request body for beacon, and get all info from session.
  // If you send JSON, you might need to parse request.text() then JSON.parse().
  // For this use case, we'll rely on session validation via headers.

  const session = await validateSession(request);

  if (!session) {
    // Can't do much if session is invalid, but beacon was sent.
    // Log or ignore. For beacon, returning an error doesn't really help client.
    console.log('[Beacon] No valid session found or auth headers missing.');
    return NextResponse.json({ message: 'No session' }, { status: 200 }); // Beacon expects 2xx
  }

  console.log(`[Beacon] Received signout/undeploy request for user: ${session.userId} (${session.username})`);

  try {
    // 1. Perform Undeploy if active
    if (session.deployTimestamp && session.activeFormNumber) {
      const targetUsername = getLogicalUsername(session);
      if (targetUsername) {
        const stopLocaltUrl = `https://${targetUsername}.loca.lt/stop/${session.activeFormNumber}`;
        console.log(`[Beacon] Attempting auto-undeploy for ${session.userId} at ${stopLocaltUrl}`);
        try {
          // Using fetch for the undeploy call. sendBeacon is for client->server.
          const undeployResponse = await fetch(stopLocaltUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'bypass-tunnel-reminder': 'true',
              'User-Agent': 'MyCustomApp/1.0 (BeaconUndeploy)',
            },
            body: JSON.stringify({}), // Assuming stop action might not need specific formData
          });
          if (undeployResponse.ok) {
            console.log(`[Beacon] Successfully sent stop command to loca.lt for user ${session.userId}, form ${session.activeFormNumber}`);
          } else {
            console.error(`[Beacon] Failed to send stop command to loca.lt for user ${session.userId}. Status: ${undeployResponse.status}`);
          }
        } catch (e: any) {
          console.error(`[Beacon] Error during loca.lt fetch for undeploy:`, e.message);
        }
      } else {
        console.error(`[Beacon] Could not determine targetUsername for undeploy for user ${session.userId}.`);
      }
      // Clear deploy status in Supabase regardless of loca.lt call success to prevent re-attempts
      await updateUserDeployStatus(session.userId, null, null);
      console.log(`[Beacon] Cleared deploy status in Supabase for user ${session.userId}.`);
    } else {
      console.log(`[Beacon] No active deployment found for user ${session.userId} to undeploy.`);
    }

    // 2. Invalidate Session in Supabase
    const { error: updateSessionError } = await supabase
      .from('users')
      .update({
        session_token: null, // Or generate a new random one if 'null' isn't your invalid state
        active_session_id: null, // Or generate a new random one
      })
      .eq('id', session.userId);

    if (updateSessionError) {
      console.error(`[Beacon] Error invalidating session in Supabase for user ${session.userId}:`, updateSessionError.message);
    } else {
      console.log(`[Beacon] Successfully invalidated session in Supabase for user ${session.userId}.`);
    }

    // navigator.sendBeacon typically expects a 204 No Content or simple 200 OK.
    // The response body is usually ignored by the browser.
    return NextResponse.json({ message: 'Beacon processed' }, { status: 200 });

  } catch (error: any) {
    console.error('[Beacon] General error processing beacon request:', error.message);
    // Still return 2xx for beacon
    return NextResponse.json({ message: 'Error processing beacon', error: error.message }, { status: 200 });
  }
}
