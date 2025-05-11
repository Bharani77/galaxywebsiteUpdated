import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateAdminSession } from '@/lib/adminAuth';
import crypto from 'crypto'; // Import crypto module

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing for /api/admin/renew-token. Check environment variables.');
}
// Supabase client will be initialized within the handler using the service role key.

// Server-side token generation logic using crypto for security
const generateTokenString = (length: number = 16): string => {
  return crypto.randomBytes(Math.ceil(length * 3 / 4)).toString('base64url').slice(0, length);
};

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase (service role) not configured.' }, { status: 500 });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const adminSession = await validateAdminSession(request);
  if (!adminSession) {
    return NextResponse.json({ message: 'Admin authentication required.' }, { status: 401 });
  }

  try {
    const { userId, duration: selectedDuration } = await request.json();

    if (!userId || !selectedDuration) {
      return NextResponse.json({ message: 'userId and duration are required.' }, { status: 400 });
    }
    if (!['3month', '6month', '1year'].includes(selectedDuration)) {
        return NextResponse.json({ message: 'Invalid duration provided.' }, { status: 400 });
    }

    // 1. Check if the user already has an active token
    const { data: existingTokenData, error: fetchError } = await supabase
      .from('tokengenerate')
      .select('token, expiresat') // Only select what's needed
      .eq('userid', userId)
      .not('token', 'is', null)
      .neq('token', '')
      // .eq('status', 'InUse') // Assuming 'InUse' means active, might need to adjust if status logic is different
      .maybeSingle(); // Use maybeSingle to handle 0 or 1 row without erroring on 0

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Fetched N > 1 rows" if not single, or "0 rows" if .single() and no row
        console.error('Error fetching existing token:', fetchError.message);
        throw fetchError;
    }
    
    if (existingTokenData) {
        const expiresAt = new Date(existingTokenData.expiresat);
        const currentDate = new Date();
        if (currentDate < expiresAt) {
            return NextResponse.json({ message: 'User already has an active token. Please delete the existing token before renewing.' }, { status: 409 }); // 409 Conflict
        } else {
            // Token exists but is expired, delete it
            const { error: deleteError } = await supabase
                .from('tokengenerate')
                .delete()
                .eq('token', existingTokenData.token);
            if (deleteError) {
                console.error('Failed to delete expired token during renew:', deleteError.message);
                // Decide if this is a critical failure. For now, proceed to create new one.
            }
        }
    }

    // 2. Generate and insert new token
    const newTokenString = generateTokenString();
    const createdAt = new Date().toISOString();
    const expiresAtDate = new Date();
    switch (selectedDuration) {
        case '3month': expiresAtDate.setMonth(expiresAtDate.getMonth() + 3); break;
        case '6month': expiresAtDate.setMonth(expiresAtDate.getMonth() + 6); break;
        case '1year': expiresAtDate.setFullYear(expiresAtDate.getFullYear() + 1); break;
    }

    const { data: insertedToken, error: insertTokenError } = await supabase
      .from('tokengenerate')
      .insert([{
          token: newTokenString,
          createdat: createdAt,
          expiresat: expiresAtDate.toISOString(),
          duration: selectedDuration,
          status: 'InUse', // New renewed token is immediately InUse
          userid: userId,
      }])
      .select()
      .single();

    if (insertTokenError || !insertedToken) {
      console.error('Error inserting new token for renew:', insertTokenError?.message);
      return NextResponse.json({ message: 'Failed to insert new token during renewal.' }, { status: 500 });
    }

    // 3. Update the users table with the new token
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ token: newTokenString }) // Assuming 'token' column in 'users' table stores the active token
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Error updating user table with new token:', userUpdateError.message);
      // This is a partial failure: tokengenerate has new token, but users table failed.
      // May need cleanup logic or manual intervention.
      return NextResponse.json({ message: 'Token generated and stored, but failed to update user record.' }, { status: 207 }); // Multi-Status
    }

    return NextResponse.json({ message: 'Token renewed successfully!', renewedToken: insertedToken }, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/admin/renew-token POST route:', error.message);
    return NextResponse.json({ message: 'Failed to renew token.', error: error.message }, { status: 500 });
  }
}
