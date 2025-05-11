import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateSession } from '@/lib/auth'; // Using the existing session validation

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer using module-level anon client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Added for service client

if (!supabaseUrl) {
  console.error('Supabase URL is missing for /api/auth/signout. Check environment variables.');
}
// Module-level Supabase client removed, will be created with service role key in handler.

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase (service role) not configured.' }, { status: 500 });
  }

  // Create a Supabase client with the service role key for this handler
  const supabaseService: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  // validateSession from lib/auth already uses the service key for its DB reads.
  // It expects headers from the request.
  const session = await validateSession(request); 
  if (!session || !session.userId) {
    // If no valid session, or userId is somehow missing from session,
    // there's nothing to sign out on the server-side for this request.
    // Client should still clear its local storage/cookies.
    return NextResponse.json({ message: 'No active session to sign out or authentication invalid.' }, { status: 401 });
  }

  try {
    const { error: updateError } = await supabaseService // Use service client
      .from("users")
      .update({
        session_token: null,
        active_session_id: null,
        last_logout: new Date().toISOString()
      })
      .eq("id", session.userId);

    if (updateError) {
      console.error('Failed to update user session for signout in DB:', updateError.message);
      // Even if DB update fails, client might still want to clear local session.
      // Consider if this should be a 200 with an error message or a 500.
      // For now, let's indicate server-side issue.
      return NextResponse.json({ message: 'Failed to update session on server during signout.' }, { status: 500 });
    }

    // Optionally, broadcast session termination if other active clients for this user need to know immediately.
    // However, the primary mechanism for multi-device session invalidation is often handled
    // by tokens expiring or being invalidated on next use, or by the sign-in route broadcasting.
    // For an explicit sign-out, broadcasting might be redundant if client clears local state.
    // Example if you choose to broadcast:
    /*
    try {
      const sendStatus = await supabase
        .channel('session_updates') // Use the same channel name as in signin
        .send({
          type: 'broadcast',
          event: 'session_terminated', // Use the same event name
          payload: { userId: parseInt(session.userId, 10) } 
        });
      if (sendStatus !== 'ok') {
          console.error("Error broadcasting session termination on signout. Status:", sendStatus);
      }
    } catch (e: any) {
      console.error("Exception during signout broadcast:", e.message);
    }
    */
    const response = NextResponse.json({ message: 'Sign out successful on server.' }, { status: 200 });

    // Clear the cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: -1, // Expire the cookie immediately
    };
    response.cookies.set('sessionToken', '', cookieOptions);
    response.cookies.set('sessionId', '', cookieOptions);
    response.cookies.set('userId', '', cookieOptions);
    response.cookies.set('username', '', cookieOptions);

    return response;

  } catch (error: any) {
    console.error('Error in sign-out API route:', error.message);
    return NextResponse.json({ message: 'An unexpected error occurred during sign out.' }, { status: 500 });
  }
}
