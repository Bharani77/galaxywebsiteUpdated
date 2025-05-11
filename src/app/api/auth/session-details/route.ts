import { NextRequest, NextResponse } from 'next/server';
import { validateSession, UserSession } from '@/lib/auth'; // Import UserSession type
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  const session = await validateSession(request);

  if (!session) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  let tokenExpiresAtFromDb: string | number | Date | null = null;

  if (supabaseUrl && supabaseServiceRoleKey) {
    const supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey);
    try {
      // Query the 'tokengenerate' table for the user's token expiry
      // Assuming 'userid' in 'tokengenerate' matches 'session.userId'
      // And the column is named 'expiresat'
      const { data: tokenData, error: tokenError } = await supabaseService
        .from('tokengenerate') // Your table name for token generation
        .select('expiresat')    // The column name for expiry date
        .eq('userid', session.userId) // Assuming 'userid' is the foreign key
        .order('createdat', { ascending: false }) // Corrected column name
        .limit(1)
        .single();

      if (tokenError) {
        console.error('Error fetching token expiry from tokengenerate:', tokenError.message);
        // Don't fail the whole request, just tokenExpiresAt might be null
      } else if (tokenData) {
        tokenExpiresAtFromDb = tokenData.expiresat;
      }
    } catch (e) {
      console.error('Exception fetching token expiry:', e);
    }
  } else {
    console.error('Supabase URL or Service Role Key not configured for session-details API.');
  }
  
  let tokenExpiresAtToSend: string | number | null = null;
  if (tokenExpiresAtFromDb) {
    if (tokenExpiresAtFromDb instanceof Date) {
      tokenExpiresAtToSend = tokenExpiresAtFromDb.toISOString();
    } else {
      tokenExpiresAtToSend = tokenExpiresAtFromDb; // Assuming it's already string (ISO) or number
    }
  }

  return NextResponse.json({
    userId: session.userId, // Add userId to the response
    username: session.username,
    tokenExpiresAt: tokenExpiresAtToSend,
  });
}
