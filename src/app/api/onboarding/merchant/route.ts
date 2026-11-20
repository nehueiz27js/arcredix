import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    { error: 'El alta de comercios está administrada exclusivamente desde ARCREDIX Superadmin.' },
    { status: 403 },
  );
}
