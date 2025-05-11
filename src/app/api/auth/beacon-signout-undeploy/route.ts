import { NextRequest, NextResponse } from 'next/server';
import { validateSession, UserSession } from '@/lib/auth'; // updateUserDeployStatus will be handled by performServerSideUndeploy
import { createClient, SupabaseClient } from '@supabase/supabase-js'; // Import SupabaseClient
import { performServerSideUndeploy } from '@/lib/deploymentUtils'; // Import the centralized undeploy function

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer using module-level anon client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // For creating service client

// Helper function getLogicalUsername is now in deploymentUtils.ts, so not needed here.

export async function POST(request: NextRequest) {
  // navigator.sendBeacon sends data as 'application/x-www-form-urlencoded', 'multipart/form-data', or 'text/plain'
  // It's simpler to not rely on a request body for beacon, and get all info from session.
  // If you send JSON, you might need to parse request.text() then JSON.parse().
  // For this use case, we'll rely on session validation via headers.

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('[Beacon] Server configuration error: Supabase (service role) not configured.');
    // For beacon, still return 2xx
    return NextResponse.json({ message: 'Beacon processed with server config error' }, { status: 200 });
  }
  const supabaseService: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const session = await validateSession(request); // validateSession creates its own Supabase client

  if (!session) {
    // Can't do much if session is invalid, but beacon was sent.
    // Log or ignore. For beacon, returning an error doesn't really help client.
    console.log('[Beacon] No valid session found or auth headers missing.');
    return NextResponse.json({ message: 'No session' }, { status: 200 }); // Beacon expects 2xx
  }

  console.log(`[Beacon] Received signout/undeploy request for user: ${session.userId} (${session.username})`);

  try {
    // 1. Perform Undeploy if active using the centralized function
    // performServerSideUndeploy handles checking deployTimestamp and activeFormNumber internally.
    // It also updates the Supabase DB regarding deployment status.
    const undeployResult = await performServerSideUndeploy(
      session.userId,
      session.username, // Plain username for logical username generation
      session.deployTimestamp,
      session.activeFormNumber,
      null, // activeRunId - beacon does not know this, so pass null
      supabaseService // Pass the service client
    );

    if (!undeployResult.success) {
      // Log the failure but proceed with session invalidation as this is a beacon.
      console.error(`[Beacon] Server-side undeploy attempt for user ${session.userId} had issues: ${undeployResult.message}`);
    } else {
      console.log(`[Beacon] Server-side undeploy attempt for user ${session.userId} processed: ${undeployResult.message}`);
    }

    // 2. Invalidate Session in Supabase
    // Note: The original code used a module-level 'supabase' client.
    // It's better to use the 'supabaseService' client created above for consistency.
    const { error: updateSessionError } = await supabaseService
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
