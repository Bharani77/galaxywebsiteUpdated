import { NextRequest, NextResponse } from 'next/server';
import { validateSession, UserSession } from '@/lib/auth'; // Assuming @/ is configured for src/

// Helper function to get the logical username.
// Adjust this if your session.username is not the logicalUsername needed for loca.lt
function getLogicalUsername(session: UserSession): string {
  // In GalaxyForm.tsx, logicalUsername is created as:
  // const suffix = '7890'; 
  // const logicalUsername = `${storedUsername}${suffix}`;
  // We assume session.username from auth.ts is already this logicalUsername.
  // If session.username is the 'displayedUsername', you'd append the suffix here.
  // For example: return `${session.username}7890`;
  return session.username; 
}

export async function POST(request: NextRequest) {
  const session = await validateSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, formNumber, formData, logicalUsername: clientProvidedLogicalUsername } = body;

    if (!action || !formNumber || !formData) {
      return NextResponse.json({ message: 'Missing required parameters: action, formNumber, or formData.' }, { status: 400 });
    }

    const validActions = ['start', 'stop', 'update'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ message: 'Invalid action.' }, { status: 400 });
    }

    // Use client-provided logical username if available and trustworthy, otherwise derive from session.
    // For security, it's often better to rely on session-derived data if possible.
    // Here, we prioritize client-provided if it exists, assuming it's correctly passed from frontend.
    const targetUsername = clientProvidedLogicalUsername || getLogicalUsername(session);
    if (!targetUsername) {
        console.error('Logical username for loca.lt could not be determined.');
        return NextResponse.json({ message: 'Configuration error: Unable to determine target username for loca.lt.' }, { status: 500 });
    }


    const localtUrl = `https://${targetUsername}.loca.lt/${action}/${formNumber}`;

    const localtResponse = await fetch(localtUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true', // Forwarding the header from original client call
      },
      body: JSON.stringify(formData), // formData is already the modified one like { RC1: 'value', ... }
    });

    const responseData = await localtResponse.json().catch(() => null); // Try to parse JSON, but handle non-JSON too

    if (localtResponse.ok) {
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
