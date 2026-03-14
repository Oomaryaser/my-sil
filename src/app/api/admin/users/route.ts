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
        u.id,
        u.name,
        u.email,
        u.role,
        u.subscription_status,
        u.subscription_started_at,
        u.subscription_expires_at,
        u.created_at,
        CASE
          WHEN u.groq_api_key_encrypted IS NULL OR u.groq_api_key_encrypted = '' THEN FALSE
          ELSE TRUE
        END AS has_groq_api_key,
        (
          SELECT COUNT(*)::int
          FROM feature_requests fr
          WHERE fr.user_id = u.id
        ) AS feature_request_count,
        (
          SELECT COUNT(*)::int
          FROM planned_expenses pe
          WHERE pe.user_id = u.id
        ) AS planned_expenses_count,
        (
          SELECT COUNT(*)::int
          FROM actual_expenses ae
          WHERE ae.user_id = u.id
        ) AS actual_expenses_count,
        (
          SELECT COUNT(*)::int
          FROM income_sources inc
          WHERE inc.user_id = u.id
        ) AS income_sources_count,
        (
          SELECT COUNT(*)::int
          FROM habits h
          WHERE h.user_id = u.id
        ) AS habits_count
      FROM users u
      ORDER BY u.created_at DESC
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
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const subscriptionStatus = typeof body.subscriptionStatus === 'string' ? body.subscriptionStatus : '';
    const subscriptionExpiresAt = typeof body.subscriptionExpiresAt === 'string' ? body.subscriptionExpiresAt : '';

    if (!userId) {
      return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 });
    }

    if (subscriptionStatus !== 'active' && subscriptionStatus !== 'suspended') {
      return NextResponse.json({ error: 'حالة الاشتراك غير صالحة' }, { status: 400 });
    }

    if (!subscriptionExpiresAt) {
      return NextResponse.json({ error: 'تاريخ انتهاء الاشتراك مطلوب' }, { status: 400 });
    }

    await sql`
      UPDATE users
      SET
        subscription_status = ${subscriptionStatus},
        subscription_expires_at = ${subscriptionExpiresAt}::timestamp,
        updated_at = NOW()
      WHERE id = ${userId}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
