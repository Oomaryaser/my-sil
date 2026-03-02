import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await requireUser(req, { requireSubscription: false });
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const rows = await sql`
      SELECT id, user_id, title, details, status, admin_note, created_at, updated_at
      FROM feature_requests
      WHERE user_id = ${auth.user.id}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req, { requireSubscription: false });
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const details = typeof body.details === 'string' ? body.details.trim() : '';

    if (title.length < 3) {
      return NextResponse.json({ error: 'اكتب عنواناً أوضح للتطوير' }, { status: 400 });
    }

    if (details.length < 5) {
      return NextResponse.json({ error: 'اكتب تفاصيل أكثر بالملاحظة' }, { status: 400 });
    }

    await sql`
      INSERT INTO feature_requests (id, user_id, title, details, status, admin_note, updated_at)
      VALUES (
        ${randomUUID()},
        ${auth.user.id},
        ${title},
        ${details},
        'pending',
        'راح تصير هاي الخاصية خلال أقل من يوم.',
        NOW()
      )
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
