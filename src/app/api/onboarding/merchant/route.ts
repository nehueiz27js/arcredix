import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth/server';
import { getDatabase } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const onboardingSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().max(160).optional().default(''),
  ownerName: z.string().trim().min(2).max(120),
  taxId: z.string().trim().max(40).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  whatsappPhone: z.string().trim().max(40).optional().default(''),
});

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user?.id || !user.email) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión para completar el alta.' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Revisá los datos del comercio. Algunos campos están incompletos o superan el límite permitido.' },
      { status: 400 },
    );
  }

  try {
    const sql = getDatabase();
    const existing = await sql`
      SELECT merchant_id
      FROM public.merchant_users
      WHERE auth_subject = ${user.id}
        AND status = 'active'
      LIMIT 1
    `;
    const existingRows = (Array.isArray(existing) ? existin���q�^