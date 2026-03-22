import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';
import { getEpicGoalTotals, getMonthGoalAvailability } from '@/lib/epic-goals';

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const epicGoalId = typeof body.epic_goal_id === 'string' ? body.epic_goal_id : '';
    const month = typeof body.month === 'string' ? body.month : '';
    const amount = Number(body.amount || 0);
    const adjustmentAmount = Number(body.adjustment_amount || 0);
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const adjustmentNote = typeof body.adjustment_note === 'string' ? body.adjustment_note.trim() : '';

    if (!id || !epicGoalId || !month || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'بيانات التحويل غير مكتملة' }, { status: 400 });
    }

    if (Number.isNaN(adjustmentAmount) || adjustmentAmount < 0) {
      return NextResponse.json({ error: 'هامش الخطأ غير صالح' }, { status: 400 });
    }

    const goalRows = await sql`
      SELECT id
      FROM epic_goals
      WHERE id = ${epicGoalId} AND user_id = ${auth.user.id}
      LIMIT 1
    `;

    if (!goalRows.length) {
      return NextResponse.json({ error: 'الهدف الملحمي غير موجود' }, { status: 400 });
    }

    const availability = await getMonthGoalAvailability(sql, auth.user.id, month);
    if (availability.availableToAllocate <= 0) {
      return NextResponse.json({ error: 'لا يوجد فائض متاح للتحويل في هذا الشهر' }, { status: 400 });
    }

    if (amount + adjustmentAmount > availability.availableToAllocate) {
      return NextResponse.json({
        error: `المتاح للتحويل حالياً هو ${availability.availableToAllocate}`,
      }, { status: 400 });
    }

    await sql`
      INSERT INTO epic_goal_allocations (id, user_id, epic_goal_id, month, amount, notes)
      VALUES (${id}, ${auth.user.id}, ${epicGoalId}, ${month}, ${amount}, ${notes})
    `;

    if (adjustmentAmount > 0) {
      await sql`
        INSERT INTO surplus_adjustments (id, user_id, allocation_id, month, amount, notes)
        VALUES (${randomUUID()}, ${auth.user.id}, ${id}, ${month}, ${adjustmentAmount}, ${adjustmentNote || `هامش خطأ في فائض ${month}`})
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const allocationRows = await sql`
      SELECT id, epic_goal_id, amount
      FROM epic_goal_allocations
      WHERE id = ${id} AND user_id = ${auth.user.id}
      LIMIT 1
    `;

    if (!allocationRows.length) {
      return NextResponse.json({ error: 'التحويل غير موجود' }, { status: 404 });
    }

    const allocation = allocationRows[0];
    const goalTotals = await getEpicGoalTotals(sql, auth.user.id, String(allocation.epic_goal_id));
    if (Number(allocation.amount) > goalTotals.currentBalance) {
      return NextResponse.json({
        error: 'لا يمكن حذف هذا التحويل لأن جزءاً منه تم صرفه من الهدف',
      }, { status: 400 });
    }

    await sql`
      DELETE FROM epic_goal_allocations
      WHERE id = ${id} AND user_id = ${auth.user.id}
    `;

    await sql`
      DELETE FROM surplus_adjustments
      WHERE allocation_id = ${id} AND user_id = ${auth.user.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
