import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updatePhoneSchema = z.object({
  phone: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const userId = session.user.id;
    const body = await req.json();

    const parsed = updatePhoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { phone } = parsed.data;

    // Update user phone
    const user = await prisma.user.update({
      where: { id: userId },
      data: { phone: phone || null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('[PUT /api/personal/user/phone]', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
