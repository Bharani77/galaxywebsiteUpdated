import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/utils/rateLimit';
import { isBrowserRequest } from '@/utils/securityChecks';
import { z } from 'zod'; // Add zod for validation

const TIMEOUT_MS = 5000;
const MAX_PAYLOAD_SIZE = 1024 * 100; // 100KB

// Input validation schemas
const ParamsSchema = z.object({
  action: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  formNumber: z.string().regex(/^[0-9]+$/)
});

const RequestSchema = z.object({
  data: z.any(),
  username: z.string().min(3).max(50)
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(
  request: Request,
  { params }: { params: { action: string; formNumber: string } }
) {
  try {
    // Request size validation
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: 'Payload too large' },
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
          headers: {
            'Retry-After': '60'
          }
        }
      );
    }

    // Validate params
    const validatedParams = ParamsSchema.safeParse(params);
    if (!validatedParams.success) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    // Add timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS)
    );

    const responsePromise = handleRequest(request, params);
    const response = await Promise.race([responsePromise, timeoutPromise]);

    return response;

  } catch (error) {
    console.error('[API Error]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleRequest(request: Request, params: {action: string, formNumber: string}) {
  const sessionToken = request.headers.get('authorization')?.split(' ')[1];
  const body = await request.json();

  // Validate request body
  const validatedBody = RequestSchema.safeParse(body);
  if (!validatedBody.success) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { data, username } = validatedBody.data;

  // Verify session and user status
  const { data: user } = await supabase
    .from("users")
    .select("token, session_token")
    .eq("username", username)
    .eq("session_token", sessionToken)
    .single();

  if (!user?.token || user.session_token !== sessionToken) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  // Make internal API call with sanitized values
  const baseUrl = process.env.MODAL_API_BASE_URL!.replace('{username}', encodeURIComponent(username));
  const sanitizedAction = encodeURIComponent(params.action);
  const sanitizedFormNumber = encodeURIComponent(params.formNumber);

  try {
    const response = await fetch(
      `${baseUrl}/${sanitizedAction}/${sanitizedFormNumber}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': crypto.randomUUID()
        },
        body: JSON.stringify(data)
      }
    );

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
  } catch (error) {
    throw new Error('API call failed');
  }
}