import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ServerAPI } from '@/lib/server-api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isBrowserRequest = (request: NextRequest) => {
    const userAgent = request.headers.get('user-agent') || '';
    return userAgent && 
           !userAgent.toLowerCase().includes('curl') && 
           !userAgent.toLowerCase().includes('postman') &&
           !userAgent.toLowerCase().includes('axios');
};

export const validateSession = async (sessionToken: string | null, username: string) => {
    if (!sessionToken) return false;

    // Check session validity
    const { data: user, error } = await supabase
        .rpc('validate_user_session', {
            p_username: username,
            p_session_token: sessionToken
        });

    return !error && user;
};