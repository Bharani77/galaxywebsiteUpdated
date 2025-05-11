import { NextRequest, NextResponse } from 'next/server';
// import { cookies } from 'next/headers'; // cookies() is for reading in Route Handlers
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto'; // Import crypto module
import bcrypt from 'bcrypt'; // Import bcrypt

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer using module-level anon client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Added for service client

if (!supabaseUrl) {
  console.error('Supabase URL is missing for /api/auth/signin. Check environment variables.');
}
// Module-level Supabase client removed, will be created with service role key in handler.

const generateSessionToken = (): string => {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer); // Assuming this is intended and works in the environment, or should be crypto.randomBytes() for Node.js
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('') + Date.now().toString(36);
};

const generateSessionId = (): string => {
  return crypto.randomUUID();
};

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase (service role) not configured.' }, { status: 500 });
  }

  // Create a Supabase client with the service role key for this handler
  const supabaseService: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Username and password are required.' }, { status: 400 });
    }

    // 1. Authenticate User (from authenticateUser)
    const { data: user, error: authError } = await supabaseService // Use service client
      .from("users")
      .select("id, username, password, active_session_id, login_count")
      .eq("username", username)
      .single();

    if (authError || !user) {
      console.error('Authentication error or user not found:', authError?.message);
      return NextResponse.json({ message: 'Invalid credentials (user not found or DB error).' }, { status: 401 });
    }

    // Compare hashed password
    const passwordIsValid = await bcrypt.compare(password, user.password); // `password` is plain text from request, `user.password` is hash from DB
    if (!passwordIsValid) {
      console.log(`Password validation failed for user: ${username}. Provided password (plain): "${password}", Stored hash from DB: "${user.password}"`); 
      return NextResponse.json({ message: 'Invalid credentials (password mismatch).' }, { status: 401 });
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
      // Using service client for broadcast as well for consistency and to bypass potential RLS on broadcast.
      try {
        const sendStatus = await supabaseService // Use service client
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
    const { error: updateError } = await supabaseService // Use service client
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

    // 5. Set session data as HTTP-only cookies on the response
    const response = NextResponse.json({
      message: 'Sign in successful.',
      username: user.username 
    });

    const oneDayInSeconds = 24 * 60 * 60;
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: oneDayInSeconds,
    };

    response.cookies.set('sessionToken', newSessionToken, cookieOptions);
    response.cookies.set('sessionId', newSessionId, cookieOptions);
    response.cookies.set('userId', user.id.toString(), cookieOptions);
    response.cookies.set('username', user.username, cookieOptions);

    return response;

  } catch (error: any) {
    console.error('Error in sign-in API route:', error.message);
    return NextResponse.json({ message: 'An unexpected error occurred during sign in.' }, { status: 500 });
  }
}
