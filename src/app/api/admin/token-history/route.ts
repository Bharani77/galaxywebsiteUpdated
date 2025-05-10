import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateAdminSession } from '@/lib/adminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing for /api/admin/token-history. Check environment variables.');
}
const supabase: SupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase not configured.' }, { status: 500 });
  }

  const adminSession = await validateAdminSession(request);
  if (!adminSession) {
    return NextResponse.json({ message: 'Admin authentication required.' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('tokengenerate')
      .select('id, token, status, duration, createdat, expiresat, userid') // Select all relevant fields
      .order('createdat', { ascending: false });

    if (error) {
      console.error('Error fetching token history:', error.message);
      throw error;
    }

    return NextResponse.json(data || []); // Return data or empty array if null

  } catch (error: any) {
    console.error('Error in /api/admin/token-history route:', error.message);
    return NextResponse.json({ message: 'Failed to fetch token history.', error: error.message }, { status: 500 });
  }
}
