import { NextRequest, NextResponse } from 'next/server';
import { validateSession, UserSession, updateUserDeployStatus } from '@/lib/auth'; // Assuming @/ is configured for src/
import { getLogicalUsername } from '@/lib/deploymentUtils'; // Import from deploymentUtils

const ONE_HOUR_MS = 60 * 60 * 1000;

// Helper function getLogicalUsername is now imported from deploymentUtils.ts

export async function POST(request: NextRequest) {
  const session = await validateSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  // Always derive targetUsername from the authenticated session for security.
  // Pass an object { username: session.username } to match the expected signature in deploymentUtils
  const targetUsername = getLogicalUsername({ username: session.username }); 
  if (!targetUsername || targetUsername.startsWith('invalid_user_')) { // Check for invalid user marker
      console.error('Logical username for loca.lt could not be determined from session or session username was missing.');
      return NextResponse.json({ message: 'Configuration error: Unable to determine target username for loca.lt from session.' }, { status: 500 });
  }

  // Auto-undeploy logic
  if (session.deployTimestamp && session.activeFormNumber) {
    const deployTime = new Date(session.deployTimestamp).getTime();
    if (Date.now() - deployTime > ONE_HOUR_MS) {
      console.log(`User ${session.userId} session for form ${session.activeFormNumber} exceeded 1 hour. Triggering auto-undeploy.`);
      
      const stopLocaltUrl = `https://${targetUsername}.loca.lt/stop/${session.activeFormNumber}`;
      try {
        await fetch(stopLocaltUrl, { // Fire-and-forget stop call
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true',
            'User-Agent': 'MyCustomApp/1.0 (AutoUndeploy)',
          },
          body: JSON.stringify({}), // Assuming stop action might not need specific formData
        });
        console.log(`Auto-undeploy call to ${stopLocaltUrl} initiated for user ${session.userId}.`);
      } catch (e: any) {
        console.error(`Error during auto-undeploy fetch for ${stopLocaltUrl}:`, e.message);
        // Continue to update Supabase even if fetch fails, to prevent repeated attempts.
      }

      await updateUserDeployStatus(session.userId, null, null);
      return NextResponse.json(
        { 
          autoUndeployed: true, 
          message: "Automatic Undeploy has been done since it is more than an hour being used. Kindly perform redeploy to use KickLock again." 
        }, 
        { status: 409 } // 409 Conflict is a reasonable status here
      );
    }
  }

  try {
    const body = await request.json();
    const { action, formNumber, formData } = body;

    if (!action || typeof formNumber !== 'number' || !formData) {
      return NextResponse.json({ message: 'Missing or invalid parameters: action, formNumber, or formData.' }, { status: 400 });
    }

    const validActions = ['start', 'stop', 'update'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ message: 'Invalid action.' }, { status: 400 });
    }

    // Validate formNumber (already present, but good to keep)
    if (!Number.isInteger(formNumber) || formNumber < 1 || formNumber > 5) { // Assuming 1-5 are valid form numbers
      return NextResponse.json({ message: 'Invalid formNumber.' }, { status: 400 });
    }
    
    const localtUrl = `https://${targetUsername}.loca.lt/${action}/${formNumber}`;

    const localtResponse = await fetch(localtUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true', // Forwarding the header from original client call
        'User-Agent': 'MyCustomApp/1.0', // Adding a custom User-Agent
      },
      body: JSON.stringify(formData), // formData is already the modified one like { RC1: 'value', ... }
    });

    const responseData = await localtResponse.json().catch(() => null);

    if (localtResponse.ok) {
      if (action === 'start') {
        await updateUserDeployStatus(session.userId, new Date().toISOString(), formNumber);
      } else if (action === 'stop') {
        // Clear deploy status if this stop action matches the deployed form
        // Or if it's a general stop, perhaps clear if any form is active (more complex logic)
        // For now, let's assume a stop for a specific form clears its status
        if (session.activeFormNumber === formNumber) {
          await updateUserDeployStatus(session.userId, null, null);
        }
      }
      return NextResponse.json(responseData || { message: 'Action completed successfully.' }, { status: localtResponse.status });
    } else {
      console.error(`loca.lt API error: ${localtResponse.status} for URL ${localtUrl}`, responseData);
      return NextResponse.json({ message: `Failed to perform action via loca.lt. Status: ${localtResponse.status}`, error: responseData }, { status: localtResponse.status });
    }

  } catch (error: any) {
    console.error('Error in loca.lt action API route:', error);
    if (error.code === 'ENOTFOUND' || error.cause?.code === 'ENOTFOUND') {
        return NextResponse.json({ message: `Could not resolve ${error.hostname || 'loca.lt host'}. Ensure the tunnel is active and the username is correct.`, error: error.message }, { status: 503 });
    }
    return NextResponse.json({ message: 'Internal server error.', error: error.message }, { status: 500 });
  }
}
