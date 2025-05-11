import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateAdminSession } from '@/lib/adminAuth'; // Using the new admin session validation

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing for /api/admin/token-user-details. Check environment variables.');
}
// Supabase client will be initialized within the handler using the service role key.

interface TokenUserDetail {
    token: string;
    duration: string | null;
    createdat: string | null;
    expiresat: string | null;
    username: string;
    userId: string;
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase (service role) not configured.' }, { status: 500 });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const adminSession = await validateAdminSession(request);
  if (!adminSession) {
    return NextResponse.json({ message: 'Admin authentication required.' }, { status: 401 });
  }

  try {
    // Fetch users from the users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, token'); // 'token' here is the signup token associated with user

    if (usersError) {
      console.error('Error fetching users for admin dashboard:', usersError.message);
      throw usersError;
    }

    // Fetch tokens from the tokengenerate table
    const { data: tokens, error: tokensError } = await supabase
      .from('tokengenerate')
      .select('token, duration, createdat, expiresat, userid, status'); // Added 'status'

    if (tokensError) {
      console.error('Error fetching tokens for admin dashboard:', tokensError.message);
      throw tokensError;
    }

    // Merge users and tokens data
    const formattedData: TokenUserDetail[] = (users || []).map((user) => {
      // Find the token from 'tokengenerate' that is currently active for this user.
      // A user might have multiple tokens in tokengenerate if they renew,
      // so we might need more specific logic if 'users.token' isn't the definitive active one.
      // The client-side logic implies 'users.token' might be one token,
      // and 'tokengenerate' might have others.
      // For now, let's find a token in 'tokengenerate' linked by 'userid'.
      // If multiple, this picks the first. Consider sorting by createdat if needed.
      const userSpecificTokenEntry = (tokens || []).find(t => t.userid === user.id && t.status !== 'Expired'); // Assuming you might add status to tokengenerate

      return {
        userId: user.id.toString(),
        username: user.username || 'N/A',
        // Prioritize token from tokengenerate if linked and active, fallback to users.token
        token: userSpecificTokenEntry?.token || user.token || 'N/A', 
        duration: userSpecificTokenEntry?.duration || 'N/A',
        createdat: userSpecificTokenEntry?.createdat || 'N/A',
        expiresat: userSpecificTokenEntry?.expiresat || null,
      };
    });

    return NextResponse.json(formattedData);

  } catch (error: any) {
    console.error('Error in /api/admin/token-user-details route:', error.message);
    return NextResponse.json({ message: 'Failed to fetch token user details.', error: error.message }, { status: 500 });
  }
}
