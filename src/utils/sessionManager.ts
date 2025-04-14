import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from './encryption';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'secure_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SessionData {
  userId: string;
  sessionId: string;
  username: string;
}

export async function createSecureSession(userId: string): Promise<void> {
  const sessionId = crypto.randomUUID();
  const encryptedSession = await encrypt(JSON.stringify({
    id: sessionId,
    userId,
    exp: Date.now() + SESSION_DURATION
  }));

  await supabase
    .from('users')
    .update({ 
      active_session_id: sessionId,
      last_login: new Date().toISOString()
    })
    .eq('id', userId);

  (await cookies()).set({
    name: COOKIE_NAME,
    value: encryptedSession,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION / 1000
  });
}

export async function validateSecureSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    if (!sessionCookie?.value) return false;

    const decrypted = await decrypt(sessionCookie.value);
    const session = JSON.parse(decrypted);

    if (Date.now() > session.exp) {
      (await cookies()).delete(COOKIE_NAME);
      return false;
    }

    const { data } = await supabase
      .from('users')
      .select('active_session_id')
      .eq('active_session_id', session.id)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

export async function clearSecureSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function validateSession(sessionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('active_session_id')
      .eq('active_session_id', sessionId)
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  
  await supabase
    .from('users')
    .update({ 
      active_session_id: sessionId,
      last_login: new Date().toISOString()
    })
    .eq('id', userId);

  return sessionId;
}

export async function terminateSession(sessionId: string): Promise<void> {
  await supabase
    .from('users')
    .update({ 
      active_session_id: null,
      last_logout: new Date().toISOString()
    })
    .eq('active_session_id', sessionId);
}
