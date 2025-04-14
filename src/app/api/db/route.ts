import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key for server-side
  {
    auth: {
      persistSession: false
    }
  }
);

export async function POST(request: Request) {
  try {
    const { table, action, query, data } = await request.json();
    
    // Validate request
    if (!table || !action) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    let result;
    switch (action) {
      case 'select':
        result = await supabase
          .from(table as string)
          .select(query.select as string)
          .eq(query.field as string, query.value);
        break;
      case 'update':
        result = await supabase
          .from(table as string)
          .update(data as Record<string, any>)
          .eq(query.field as string, query.value);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
