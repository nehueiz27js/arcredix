import { NextResponse } from 'next/server';
import { destroyClientSession } from '@/lib/auth/client-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await destroyClientSession();
  return NextResponse.json({ success: true }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
