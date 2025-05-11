import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateAdminSession } from '@/lib/adminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing for /api/admin/user-token-link. Check environment variables.');
}
// Supabase client will be initialized within the handler using the service role key.

export async function DELETE(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase (service role) not configured.' }, { status: 500 });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const adminSession = await validateAdminSession(request);
  if (!adminSession) {
    return NextResponse.json({ message: 'Admin authentication required.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const tokenValue = searchParams.get('token');

    if (!userId || !tokenValue) {
      return NextResponse.json({ message: 'userId and token query parameters are required.' }, { status: 400 });
    }

    // 1. Delete the token from the tokengenerate table by its value
    const { error: tokenDeleteError } = await supabase
      .from('tokengenerate')
      .delete()
      .eq('token', tokenValue);

    if (tokenDeleteError) {
      console.error(`Error deleting token ${tokenValue} from tokengenerate:`, tokenDeleteError.message);
      // Proceed to nullify in users table even if this fails, or decide on stricter error handling
    }

    // 2. Update the users table to set token = null for the user
    // Assuming 'token' is the column in 'users' table that might store this token value.
    // If the 'users.token' column is meant for something else (e.g. signup token), adjust this logic.
    // The client code was doing this, so replicating the intent.
    const { error: userUpdateError }: { error: any } = await supabase
      .from('users')
      .update({ token: null }) 
      .eq('id', userId)
      .eq('token', tokenValue); // Ensure we only nullify if it matches the token being deleted

    if (userUpdateError) {
      console.error(`Error nullifying token for user ${userId}:`, userUpdateError.message);
      return NextResponse.json({ message: `Failed to nullify token for user: ${userUpdateError.message}` }, { status: 500 });
    }

    // If tokenDeleteError occurred but userUpdateError did not, it's a partial success.
    if (tokenDeleteError && !userUpdateError) {
        return NextResponse.json({ message: `Failed to delete token from generation table, but token nullified for user: ${tokenDeleteError.message}` }, { status: 207 });
    }
    else if (!tokenDeleteError && userUpdateError) { // Should have been caught above, but for completeness
        return NextResponse.json({ message: `Token deleted from generation table, but failed to nullify for user: ${userUpdateError?.message || 'Unknown error'}` }, { status: 207 });
    }


    return NextResponse.json({ message: 'Token link removed successfully.' }, { status: 200 });

  } catch (error: unknown) { // Changed from any to unknown for better type safety
    let errorMessage = 'An unexpected error occurred while removing user token link.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof (error as any).message === 'string') {
      // Attempt to get message if it's an object with a message property
      errorMessage = (error as any).message;
    }
    console.error('Error in /api/admin/user-token-link DELETE route:', errorMessage, error); // Log the original error too
    
    // Explicitly type the payload object
    const errorPayload: { message: string; errorDetail?: string } = {
      message: 'Failed to remove user token link.',
      errorDetail: errorMessage 
    };
    return NextResponse.json(errorPayload, { status: 500 });
  }
}
