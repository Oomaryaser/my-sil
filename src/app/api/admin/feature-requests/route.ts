import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await requireUser(req, { requireAdmin: true, requireSubscription: false });
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const rows = await sql`
      SELECT
        fr.id,
        fr.user_id,
        fr.title,
        fr.details,
        fr.status,
        fr.admin_note,
        fr.created_at,
        fr.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM feature_requests fr
      JOIN users u ON u.id = fr.user_id
      ORDER BY fr.created_at DESC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireUser(req, { requireAdmin: true, requireSubscription: false });
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const body = await req.json();
    const requestId = typeof body.requestId === 'string' ? body.requestId : '';
    const status = typeof body.status === 'string' ? body.status : '';
    const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : '';

    if (!requestId) {
      return NextResponse.json({ error: 'معرف الطلب مطلوب' }, { status: 400 });
    }

    if (!['pending', 'planned', 'in_progress', 'done'].includes(status)) {
      return NextResponse.json({ error: 'حالة الطلب غير صالحة' }, { status: 400 });
    }

    await sql`
      UPDATE feature_requests
      SET
        status = ${status},
        admin_note = ${adminNote || 'راح تصير هاي الخاصية خلال أقل من يوم.'},
        updated_at = NOW()
      WHERE id = ${requestId}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
