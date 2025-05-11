import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateAdminSession } from '@/lib/adminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // URL can often be public
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for admin operations

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing for /api/admin/users. Check environment variables.');
  // Do not initialize supabase client here if config is missing, handle in function
}
// Initialize Supabase client per request or globally if appropriate, ensuring service key is used.
// For this route, it's safer to initialize within the handler to ensure service key is checked.

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
    const tokenValue = searchParams.get('token'); // The actual token string

    if (!userId || !tokenValue) {
      return NextResponse.json({ message: 'userId and token query parameters are required.' }, { status: 400 });
    }

    // 1. Delete the user from the users table
    const { error: userDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (userDeleteError) {
      console.error(`Error deleting user ${userId}:`, userDeleteError.message);
      // If user deletion fails, we might not want to proceed with token deletion,
      // or handle it based on specific requirements (e.g., if token must be deleted regardless).
      return NextResponse.json({ message: `Failed to delete user: ${userDeleteError.message}` }, { status: 500 });
    }

    // 2. Delete the associated token from the tokengenerate table
    // It's possible the token is associated via userid or the token value itself.
    // The client code uses .eq('token', token), so we'll match that.
    const { error: tokenDeleteError } = await supabase
      .from('tokengenerate')
      .delete()
      .eq('token', tokenValue); // Assuming 'token' column stores the unique token string

    if (tokenDeleteError) {
      console.error(`Error deleting token ${tokenValue} from tokengenerate:`, tokenDeleteError.message);
      // User was deleted, but token deletion failed. This is a partial success.
      // Return a specific message indicating this.
      return NextResponse.json({ message: `User deleted, but failed to delete associated token: ${tokenDeleteError.message}` }, { status: 207 }); // Multi-Status
    }

    return NextResponse.json({ message: 'User and associated token deleted successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/admin/users DELETE route:', error.message);
    return NextResponse.json({ message: 'Failed to delete user and/or token.', error: error.message }, { status: 500 });
  }
}
