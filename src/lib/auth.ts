import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define a type for your session data
export interface UserSession {
  userId: string;
  username: string; // This would be the username from the users table
  deployTimestamp?: string | null; // ISO string format for timestamp
  activeFormNumber?: number | null;
  // Add other session properties as needed
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Check environment variables.');
  // Potentially throw an error or handle this state if critical for module loading
}
// Initialize Supabase client. Handle potential undefined values for keys.
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * Validates the session details from the request headers against Supabase.
 * 
 * Expects:
 * - 'Authorization': 'Bearer YOUR_SESSION_TOKEN'
 * - 'X-User-ID': 'USER_ID_FROM_SESSION_STORAGE'
 * - 'X-Session-ID': 'SESSION_ID_FROM_SESSION_STORAGE'
 * 
 * @param request The NextRequest object.
 * @returns The user session object if valid, otherwise null.
 */
export async function validateSession(request: NextRequest): Promise<UserSession | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase client not initialized in validateSession due to missing env vars.');
    return null;
  }

  const authHeader = request.headers.get('Authorization');
  const requestUserId = request.headers.get('X-User-ID');
  const requestSessionId = request.headers.get('X-Session-ID');

  if (!authHeader || !requestUserId || !requestSessionId) {
    console.log('Missing Authorization header, X-User-ID, or X-Session-ID.');
    return null;
  }

  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    console.log('Invalid Authorization header format.');
    return null;
  }
  const requestToken = tokenParts[1];

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, session_token, active_session_id, deploy_timestamp, active_form_number')
      .eq('id', requestUserId)
      .single();

    if (error) {
      console.error('Error fetching user from Supabase:', error.message);
      return null;
    }

    if (!user) {
      console.log('User not found for ID:', requestUserId);
      return null;
    }

    // Validate the token and active session ID
    if (user.session_token === requestToken && user.active_session_id === requestSessionId) {
      console.log('Session validated for user:', user.username);
      return { 
        userId: user.id.toString(), 
        username: user.username,
        deployTimestamp: user.deploy_timestamp,
        activeFormNumber: user.active_form_number
      };
    } else {
      console.log('Session validation failed: Token or Session ID mismatch.');
      if (user.session_token !== requestToken) console.log('Reason: session_token mismatch');
      if (user.active_session_id !== requestSessionId) console.log('Reason: active_session_id mismatch');
      return null;
    }
  } catch (error: any) {
    console.error('Exception during session validation:', error.message);
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
  activeFormNumber: number | null
): Promise<boolean> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase client not initialized in updateUserDeployStatus due to missing env vars.');
    return false;
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({ 
        deploy_timestamp: deployTimestamp,
        active_form_number: activeFormNumber 
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user deploy status in Supabase:', error.message);
      return false;
    }
    console.log(`Deploy status updated for user ${userId}: timestamp=${deployTimestamp}, form=${activeFormNumber}`);
    return true;
  } catch (error: any) {
    console.error('Exception during user deploy status update:', error.message);
    return false;
  }
}
