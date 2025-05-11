import { NextRequest, NextResponse } from 'next/server';
// import { cookies } from 'next/headers'; // cookies() is for reading in Route Handlers
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto'; // Import crypto module
import bcrypt from 'bcrypt'; // Import bcrypt
import { performServerSideUndeploy } from '@/lib/deploymentUtils'; // Added for server-side undeploy

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer using module-level anon client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Added for service client

if (!supabaseUrl) {
  console.error('Supabase URL is missing for /api/auth/signin. Check environment variables.');
}
// Module-level Supabase client removed, will be created with service role key in handler.

const generateSessionToken = (): string => {
  // Use crypto.randomBytes for Node.js environment, then convert to hex string
  return crypto.randomBytes(32).toString('hex') + Date.now().toString(36);
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
    // Fetch deploy_timestamp, active_form_number, and active_run_id as well
    const { data: user, error: authError } = await supabaseService // Use service client
      .from("users")
      .select("id, username, password, active_session_id, login_count, deploy_timestamp, active_form_number, active_run_id")
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

    // 3. Terminate existing session AND undeploy if active
    if (user.active_session_id) {
      console.log(`[SignIn] User ${user.username} (ID: ${user.id}) is signing in, potentially terminating existing session ${user.active_session_id}.`);

      // Check if there's any active deployment (GitHub run OR a specific loca.lt form)
      const hasActiveGitHubRun = user.deploy_timestamp && user.active_run_id;
      const hasActiveLocaltForm = user.deploy_timestamp && user.active_form_number && user.active_form_number > 0;

      if (hasActiveGitHubRun || hasActiveLocaltForm) { 
        console.log(`[SignIn] User ${user.username} has an active deployment. GitHub Run: ${user.active_run_id || 'N/A'}, Loca.lt Form: ${user.active_form_number || 'N/A'}. Timestamp: ${user.deploy_timestamp}. Attempting server-side undeploy.`);
        
        // Pass supabaseService to performServerSideUndeploy if it's designed to accept it,
        // or ensure it creates its own client if not.
        // Based on deploymentUtils.ts, it expects supabaseService as the last arg.
        const undeployResult = await performServerSideUndeploy(
          user.id.toString(),
          user.username, // Plain username for logical username generation
          user.deploy_timestamp,
          user.active_form_number,
          user.active_run_id,     // Will be used for GitHub polling
          supabaseService // Pass the existing service client
        );

        if (!undeployResult.success) {
          console.error(`[SignIn] Server-side undeploy failed for user ${user.username} during new sign-in. Reason: ${undeployResult.message}`);
          return NextResponse.json({ 
            message: `Sign-in blocked: Failed to undeploy previous active session. ${undeployResult.message} Please try again or contact support.` 
          }, { status: 409 }); 
        }
        console.log(`[SignIn] Server-side undeploy process completed for user ${user.username}. Result: ${undeployResult.message}`);
      } else {
        console.log(`[SignIn] No active deployment (neither GitHub run nor loca.lt form) found for user ${user.username} to undeploy during new sign-in.`);
      }

      // Proceed with broadcasting session termination for other tabs/devices of this user
      console.log(`[SignIn] Broadcasting session_terminated event for user ${user.id}'s old session.`);
      try {
        const sendStatus = await supabaseService
          .channel('session_updates')
          .send({
            type: 'broadcast',
            event: 'session_terminated',
            payload: { userId: user.id } 
          });
        if (sendStatus !== 'ok') {
            console.error("[SignIn] Error broadcasting session termination. Status:", sendStatus);
        }
      } catch (e) {
        console.error("[SignIn] Exception during broadcast for session termination:", e);
      }
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
