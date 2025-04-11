import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isBrowserRequest = (request: NextRequest) => {
    const userAgent = request.headers.get('user-agent');
    return userAgent && !userAgent.toLowerCase().includes('curl') && !userAgent.toLowerCase().includes('postman');
};

export const validateSession = async (sessionToken: string | null, username: string) => {
    if (!sessionToken) return false;

    const { data: user, error } = await supabase
        .from('users')
        .select('session_token')
        .eq('username', username)
        .eq('session_token', sessionToken)
        .single();

    return !error && user?.session_token === sessionToken;
};