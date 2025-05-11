import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateSession as validateUserSessionAgainstDb, UserSession } from '@/lib/auth'; // Renamed to avoid conflict

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing for /api/auth/validate-client-session. Check environment variables.');
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase (service role) not configured.' }, { status: 500 });
  }

  const supabaseService: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // The validateUserSessionAgainstDb function in '@/lib/auth' already expects headers.
    // We are calling it directly here, so it will use the headers from the incoming request to this API route.
    const userSession: UserSession | null = await validateUserSessionAgainstDb(request);

    if (!userSession) {
      return NextResponse.json({ isValid: false, message: 'Session validation failed (user or session mismatch).' }, { status: 401 });
    }

    // Now, additionally check the token status from 'tokengenerate' table
    // We need the user's actual token value for this.
    // The `validateUserSessionAgainstDb` doesn't return the token itself, only validates it.
    // We need to fetch the user's record again to get the token they are associated with,
    // or modify `validateUserSessionAgainstDb` to return it if needed.
    // For now, let's assume `userSession.userId` is what we need, and we need to get their current token from `users` table.

    const { data: userData, error: userFetchError } = await supabaseService
      .from('users')
      .select('token') // This is the token associated with the user, presumably from tokengenerate
      .eq('id', userSession.userId)
      .single();

    if (userFetchError || !userData || !userData.token) {
      console.error('Error fetching user token for validation:', userFetchError?.message);
      return NextResponse.json({ isValid: false, message: 'Could not retrieve user token for validation.' }, { status: 500 });
    }

    const userSignupToken = userData.token; // This is the token from the 'users' table

    const { data: tokenData, error: tokenError } = await supabaseService
      .from('tokengenerate')
      .select('status, token') // Select token to ensure we are checking the correct one
      .eq('token', userSignupToken) // Match against the token string
      .eq('userid', userSession.userId) // Ensure it's for this user
      .order('createdat', { ascending: false }) // Get the latest token if multiple exist for the user
      .limit(1)
      .single();
      
    if (tokenError || !tokenData) {
      // This could mean the token recorded in the 'users' table is no longer in 'tokengenerate' or is invalid
      console.log('Token not found in tokengenerate or error:', tokenError?.message);
      return NextResponse.json({ isValid: false, message: 'Associated token is invalid or not found.' }, { status: 401 });
    }

    // Potentially check tokenData.status if you have statuses like 'Expired', 'Revoked' etc.
    // For now, finding it is enough to proceed.

    return NextResponse.json({ 
      isValid: true, 
      message: 'Session is valid.',
      // Include any necessary user details from userSession if the client needs them
      userId: userSession.userId,
      username: userSession.username,
      deployTimestamp: userSession.deployTimestamp,
      activeFormNumber: userSession.activeFormNumber
    });

  } catch (error: any) {
    console.error('Error in /api/auth/validate-client-session route:', error.message);
    return NextResponse.json({ isValid: false, message: 'An unexpected error occurred during session validation.' }, { status: 500 });
  }
}
