import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateSession } from '@/lib/auth'; // Using the existing session validation

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing for /api/auth/signout. Check environment variables.');
}
const supabase: SupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase not configured.' }, { status: 500 });
  }

  const session = await validateSession(request);
  if (!session || !session.userId) {
    // If no valid session, or userId is somehow missing from session,
    // there's nothing to sign out on the server-side for this request.
    // Client should still clear its local storage.
    return NextResponse.json({ message: 'No active session to sign out or authentication invalid.' }, { status: 401 });
  }

  try {
    const { error: updateError } = await supabase
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

    return NextResponse.json({ message: 'Sign out successful on server.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error in sign-out API route:', error.message);
    return NextResponse.json({ message: 'An unexpected error occurred during sign out.' }, { status: 500 });
  }
}
