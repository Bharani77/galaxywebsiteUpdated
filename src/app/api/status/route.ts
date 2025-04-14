import { NextResponse, NextRequest } from 'next/server';
import { isBrowserRequest, validateSession } from '@/utils/securityChecks';
import { validateContentLength, sanitizeInput } from '@/utils/apiValidation';
import { rateLimit } from '@/utils/rateLimit';
import { z } from 'zod';
import { API_CONFIG } from '@/config/api';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.STATUS_API_URL || 'https://buddymaster77hugs-gradio.hf.space/api/status';
const MAX_REQUEST_SIZE = 1024; // 1KB
const FETCH_TIMEOUT = 10000; // 10 seconds

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function validateSessionInternally(token: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, active_session_id')
      .single();

    if (error || !data) return false;
    return data.active_session_id === token;
  } catch {
    return false;
  }
}

// Input validation schema
const RequestSchema = z.object({
  modal_name: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  timestamp: z.number().int().min(Date.now() - 300000) // Within last 5 minutes
});

export async function POST(request: Request) {
  try {
    // Validate request size
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (!validateContentLength(contentLength, MAX_REQUEST_SIZE)) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      );
    }

    // Validate browser request
    if (!isBrowserRequest(request as any)) {
      return NextResponse.json(
        { error: 'Invalid request source' },
        { status: 403 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(request as NextRequest) as { success: boolean };
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { 
          status: 429,
          headers: new Headers({
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'X-Frame-Options': 'DENY',
            'X-Request-ID': crypto.randomUUID(),
            'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Content-Security-Policy': "default-src 'self'",
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Server': 'Unknown', // Hide server information
          })
        }
      );
    }

    // Validate auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Invalid authorization header' },
        { status: 401 }
      );
    }

    const sessionToken = authHeader.split(' ')[1];
    const body = await request.json();

    // Validate request body
    const validationResult = RequestSchema.safeParse({
      ...body,
      timestamp: Date.now()
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // Sanitize input
    const modalName = sanitizeInput(validationResult.data.modal_name);
    if (!modalName) {
      return NextResponse.json(
        { error: 'Invalid modal name' },
        { status: 400 }
      );
    }

    // Validate session
    if (!await validateSessionInternally(sessionToken)) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Make API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      // Make internal API request server-side only
      const internalResponse = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID(),
          ...API_CONFIG.headers.internal
        },
        body: JSON.stringify({ 
          modal_name: modalName,
          _internal: true // Mark as internal request
        }),
        signal: controller.signal,
        // Prevent caching
        cache: 'no-store',
        next: { revalidate: 0 }
      });

      if (!internalResponse.ok) {
        throw new Error(`API responded with status: ${internalResponse.status}`);
      }

      const data = await internalResponse.json();

     
      return NextResponse.json(
        { success: true, deployed: data.status === "deployed" },
        {
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'X-Frame-Options': 'DENY',
            'X-Request-ID': crypto.randomUUID(),
            'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Content-Security-Policy': "default-src 'self'",
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Server': 'Unknown'
          })
        }
      ); // Added missing closing parenthesis

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    console.error('Status API error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}