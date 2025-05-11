import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define a type for your session data
export interface UserSession {
  userId: string;
  username: string; // This would be the username from the users table
  deployTimestamp?: string | null; // ISO string format for timestamp
  activeFormNumber?: number | null;
  tokenExpiresAt?: string | number | Date | null; // Re-add for the session object type
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer using module-level anon client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Added for service client

if (!supabaseUrl) {
  console.error('Supabase URL is missing for auth lib. Check environment variables.');
  // Potentially throw an error or handle this state if critical for module loading
}
// Module-level Supabase client removed, will be created with service role key in functions.

/**
 * Validates the session details from cookies against Supabase.
 * 
 * Expects cookies:
 * - 'sessionToken'
 * - 'userId'
 * - 'sessionId'
 * 
 * @param request The NextRequest object (or any object with a `cookies` accessor).
 * @returns The user session object if valid, otherwise null.
 */
export async function validateSession(request: NextRequest): Promise<UserSession | null> {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Supabase client not initialized in validateSession due to missing env vars (URL or Service Key).');
    return null;
  }

  // Create a Supabase client with the service role key for this function
  const supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey);

  const sessionTokenCookie = request.cookies.get('sessionToken');
  const userIdCookie = request.cookies.get('userId');
  const sessionIdCookie = request.cookies.get('sessionId');

  if (!sessionTokenCookie?.value || !userIdCookie?.value || !sessionIdCookie?.value) {
    console.log('Missing one or more session cookies (sessionToken, userId, sessionId).');
    return null;
  }
  
  const requestToken = sessionTokenCookie.value;
  const requestUserId = userIdCookie.value;
  const requestSessionId = sessionIdCookie.value;

  try {
    const { data: user, error } = await supabaseService // Use service client
      .from('users')
      // Temporarily remove token_expires_at from select if it's causing schema issues
      .select('id, username, session_token, active_session_id, deploy_timestamp, active_form_number')
      .eq('id', requestUserId)
      .single();

    if (error) {
      console.error('Error fetching user from Supabase (validateSession):', error.message);
      return null;
    }

    if (!user) {
      console.log('User not found for ID (validateSession):', requestUserId);
      return null;
    }

    // Validate the token and active session ID
    if (user.session_token === requestToken && user.active_session_id === requestSessionId) {
      console.log('Session validated for user (validateSession):', user.username);
      return { 
        userId: user.id.toString(), 
        username: user.username,
        deployTimestamp: user.deploy_timestamp,
        activeFormNumber: user.active_form_number,
        // tokenExpiresAt: user.token_expires_at // Temporarily remove
      };
    } else {
      console.log('Session validation failed (validateSession): Token or Session ID mismatch.');
      if (user.session_token !== requestToken) console.log('Reason (validateSession): session_token mismatch');
      if (user.active_session_id !== requestSessionId) console.log('Reason (validateSession): active_session_id mismatch');
      return null;
    }
  } catch (error: any) {
    console.error('Exception during session validation (validateSession):', error.message);
    return null;
  }
}


/**
 * Updates the deploy_timestamp and active_form_number for a user in Supabase.
 * @param userId The ID of the user to update.
 * @param deployTimestamp The new deploy timestamp (ISO string) or null.
 * @param activeFormNumber The new active form number or null.
 * @returns True if successful, false otherwise.
 */
export async function updateUserDeployStatus(
  userId: string,
  deployTimestamp: string | null,
  activeFormNumber: number | null,
  activeRunId?: number | string | null // Added activeRunId
): Promise<boolean> {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Supabase client not initialized in updateUserDeployStatus due to missing env vars (URL or Service Key).');
    return false;
  }

  // Create a Supabase client with the service role key for this function
  const supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const updateData: {
      deploy_timestamp: string | null;
      active_form_number: number | null;
      active_run_id?: number | string | null;
    } = {
      deploy_timestamp: deployTimestamp,
      active_form_number: activeFormNumber,
    };

    if (activeRunId !== undefined) { // Check if activeRunId was passed
      updateData.active_run_id = activeRunId;
    } else if (deployTimestamp === null && activeFormNumber === null) {
      // If clearing deployment, also clear run_id by default if not specified
      updateData.active_run_id = null;
    }
    // If activeRunId is not passed and it's an update (not clearing), active_run_id remains unchanged in DB.

    const { error } = await supabaseService // Use service client
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('Error updating user deploy status in Supabase (updateUserDeployStatus):', error.message);
      return false;
    }
    console.log(`Deploy status updated for user ${userId} (updateUserDeployStatus): timestamp=${deployTimestamp}, form=${activeFormNumber}, runId=${activeRunId === undefined ? '(not changed)' : activeRunId}`);
    return true;
  } catch (error: any) {
    console.error('Exception during user deploy status update (updateUserDeployStatus):', error.message);
    return false;
  }
}
