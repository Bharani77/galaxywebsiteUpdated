import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateAdminSession } from '@/lib/adminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing for /api/admin/tokens. Check environment variables.');
}
const supabase: SupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Server-side token generation logic
const generateTokenString = (): string => {
  return Array(16)
    .fill(0)
    .map(() => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      return chars.charAt(Math.floor(Math.random() * chars.length));
    })
    .join('');
};

// POST: Generate a new token
export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase not configured.' }, { status: 500 });
  }

  const adminSession = await validateAdminSession(request);
  if (!adminSession) {
    return NextResponse.json({ message: 'Admin authentication required.' }, { status: 401 });
  }

  try {
    const { duration } = await request.json();

    if (!duration || !['3month', '6month', '1year'].includes(duration)) {
      return NextResponse.json({ message: 'Invalid or missing duration.' }, { status: 400 });
    }

    const newTokenString = generateTokenString();
    const createdat = new Date().toISOString();
    const expiresat = new Date();

    switch (duration) {
        case '3month':
            expiresat.setMonth(expiresat.getMonth() + 3);
            break;
        case '6month':
            expiresat.setMonth(expiresat.getMonth() + 6);
            break;
        case '1year':
            expiresat.setFullYear(expiresat.getFullYear() + 1);
            break;
    }
    
    const { data: insertedData, error: insertError } = await supabase
      .from('tokengenerate')
      .insert([
        {
          token: newTokenString,
          duration: duration,
          status: 'Active',
          createdat: createdat,
          expiresat: expiresat.toISOString(),
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting new token:', insertError.message);
      throw insertError;
    }
    
    if (!insertedData) {
        console.error('Token insertion did not return data.');
        return NextResponse.json({ message: 'Failed to generate token (no data returned after insert).' }, { status: 500 });
    }

    return NextResponse.json(insertedData, { status: 201 });

  } catch (error: any) {
    console.error('Error in /api/admin/tokens POST route:', error.message);
    return NextResponse.json({ message: 'Failed to generate token.', error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a token by its ID
export async function DELETE(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase not configured.' }, { status: 500 });
  }

  const adminSession = await validateAdminSession(request);
  if (!adminSession) {
    return NextResponse.json({ message: 'Admin authentication required.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json({ message: 'tokenId query parameter is required.' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('tokengenerate')
      .delete()
      .eq('id', tokenId);

    if (deleteError) {
      console.error('Error deleting token from DB:', deleteError.message);
      throw deleteError;
    }

    return NextResponse.json({ message: 'Token deleted successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/admin/tokens DELETE route:', error.message);
    return NextResponse.json({ message: 'Failed to delete token.', error: error.message }, { status: 500 });
  }
}
