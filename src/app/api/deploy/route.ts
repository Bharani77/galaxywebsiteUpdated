import { NextResponse, NextRequest } from 'next/server';
import { isBrowserRequest } from '@/utils/browserCheck';
import { validateSession } from '@/utils/sessionValidator';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/utils/rateLimit';
import { z } from 'zod';

const TIMEOUT_MS = 30000; // 30 second timeout
const MAX_PAYLOAD_SIZE = 1024 * 50; // 50KB limit
const ALLOWED_ORIGINS = ['https://galaxykicklock.web.app/']; // Add your allowed origins

// Input validation schema
const RequestSchema = z.object({
  modal_name: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  timestamp: z.number().int().min(Date.now() - 300000) // Request must be within last 5 minutes
});

const API_URL = process.env.DEPLOY_API_URL || 'https://buddymaster77hugs-gradio.hf.space/api/deploy';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    // Validate HTTP method
    if (request.method !== 'POST') {
      await logSecurityEvent('invalid_method', { method: request.method });
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }

    // Validate origin
    const origin = request.headers.get('origin');
    if (!ALLOWED_ORIGINS.includes(origin ?? '')) {
      await logSecurityEvent('invalid_origin', { origin });
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      );
    }

    // Validate request size
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > MAX_PAYLOAD_SIZE) {
      await logSecurityEvent('oversized_payload', { size: contentLength });
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 413 }
      );
    }

    // Check rate limits
    const rateLimitResult = await rateLimit(request as NextRequest) as { success: boolean };
    if (!rateLimitResult.success) {
      await logSecurityEvent('rate_limit_exceeded', { ip: request.headers.get('x-forwarded-for') });
      return NextResponse.json(
        { error: 'Too many requests' },
        { 
          status: 429,
          headers: { 'Retry-After': '60' }
        }
      );
    }

    // Validate browser request
    if (!isBrowserRequest(request as any)) {
      await logSecurityEvent('invalid_request_source', { headers: Object.fromEntries(request.headers) });
      return NextResponse.json({ error: 'Invalid request source' }, { status: 403 });
    }

    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS);
    });

    // Add CORS and security headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': origin || '',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    const responsePromise = handleDeployRequest(request);
    const response = await Promise.race([responsePromise, timeoutPromise]);
    
    // Sanitize the response
    if (response instanceof NextResponse) {
      const safeResponse = {
        success: response.status === 200,
        ...(response.status !== 200 && { error: 'Operation failed' })
      };
      return NextResponse.json(safeResponse, { 
        status: response.status,
        headers
      });
    }
    return response;

  } catch (error) {
    // Sanitize error messages
    const safeErrorMessage = 'Internal server error';
    await logSecurityEvent('deploy_error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: safeErrorMessage },
      { status: 500 }
    );
  }
}

async function handleDeployRequest(request: Request) {
  const sessionToken = request.headers.get('authorization')?.split(' ')[1];
  const body = await request.json();

  // Validate request body
  const validationResult = RequestSchema.safeParse({
    ...body,
    timestamp: Date.now()
  });
  if (!validationResult.success) {
    await logSecurityEvent('invalid_request_body', { errors: validationResult.error.issues });
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }

  const { modal_name } = validationResult.data;

  if (!await validateSession(sessionToken ?? null, modal_name)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  // Verify user token status
  const { data: user } = await supabase
    .from("users")
    .select("token")
    .eq("username", modal_name)
    .single();

  if (!user?.token) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const { data: tokenData } = await supabase
    .from('tokengenerate')
    .select('status, expiresat')
    .eq('token', user.token)
    .single();

  if (!tokenData || ['Invalid', 'N/A'].includes(tokenData.status)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  if (tokenData.expiresat && new Date(tokenData.expiresat) < new Date()) {
    return NextResponse.json({ success: false, expired: true }, { status: 401 });
  }

  // Add request hash validation for the internal API call
  const requestHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(body) + process.env.INTERNAL_API_KEY)
  );
  
  const response = await fetch(process.env.DEPLOY_API_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': crypto.randomUUID(),
      'X-API-Key': process.env.INTERNAL_API_KEY || '',
      'X-Request-Hash': Array.from(new Uint8Array(requestHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    },
    body: JSON.stringify({
      repo_url: process.env.REPO_URL,
      modal_name: encodeURIComponent(modal_name)
    })
  });

  // Validate the response status
  if (!response.ok) {
    throw new Error(`API call failed with status: ${response.status}`);
  }

  return NextResponse.json(
    { success: true },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      }
    }
  );
}

async function logSecurityEvent(type: string, data: any) {
  try {
    await supabase
      .from('security_logs')
      .insert({
        event_type: type,
        event_data: data,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}