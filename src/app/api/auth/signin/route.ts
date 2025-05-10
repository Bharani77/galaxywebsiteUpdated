import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing for /api/auth/signin. Check environment variables.');
}
const supabase: SupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

const generateSessionToken = (): string => {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('') + Date.now().toString(36);
};

const generateSessionId = (): string => {
  return crypto.randomUUID();
};

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase not configured.' }, { status: 500 });
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Username and password are required.' }, { status: 400 });
    }

    // 1. Authenticate User (from authenticateUser)
    const { data: user, error: authError } = await supabase
      .from("users")
      .select("id, username, password, active_session_id, login_count")
      .eq("username", username)
      .single();

    if (authError || !user) {
      console.error('Authentication error or user not found:', authError?.message);
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    if (user.password !== password) { // Plain text password comparison (as in original)
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    // 2. Generate new session details
    const newSessionToken = generateSessionToken();
    const newSessionId = generateSessionId();

    // 3. Terminate existing session if any (from handleSubmit)
    if (user.active_session_id) {
      console.log(`Terminating existing session ${user.active_session_id} for user ${user.id}`);
      // Note: The original code updated the DB first, then sent broadcast.
      // It might be safer to ensure the DB update for termination happens
      // *before* or *atomically with* setting the new session.
      // For simplicity, following original flow:
      
      // Send broadcast first (as original code did before updating current user's session)
      // This assumes the Supabase client on the server can send broadcasts.
      // This might require admin/service_role key if not allowed by anon key for broadcast.
      // If using anon key, ensure RLS allows broadcast or this might fail silently/throw.
      try {
        const sendStatus = await supabase
          .channel('session_updates')
          .send({
            type: 'broadcast',
            event: 'session_terminated',
            payload: { userId: user.id } // Ensure this matches what client expects (e.g. int)
          });
        if (sendStatus !== 'ok') {
            console.error("Error broadcasting session termination. Status:", sendStatus);
            // Decide if this is a critical failure. For now, we'll proceed.
        }
      } catch (e) {
        console.error("Exception during broadcast:", e);
      }
      // The actual DB update to nullify the old session for *other* users happens when they try to validate their old token,
      // or if the client receives the broadcast and clears its own state.
      // The current user's old session is implicitly terminated by updating their record with the new session.
    }

    // 4. Update user's session in DB (from updateUserSession)
    const { error: updateError } = await supabase
      .from("users")
      .update({
        session_token: newSessionToken,
        active_session_id: newSessionId,
        login_count: (user.login_count || 0) + 1,
        last_login: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      console.error('Failed to update user session in DB:', updateError.message);
      return NextResponse.json({ message: 'Failed to update session.' }, { status: 500 });
    }

    // 5. Return session data to client
    return NextResponse.json({
      message: 'Sign in successful.',
      userId: user.id.toString(),
      username: user.username,
      sessionToken: newSessionToken,
      sessionId: newSessionId
    });

  } catch (error: any) {
    console.error('Error in sign-in API route:', error.message);
    return NextResponse.json({ message: 'An unexpected error occurred during sign in.' }, { status: 500 });
  }
}
