import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';
import { getEpicGoalTotals } from '@/lib/epic-goals';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const type = searchParams.get('type');

    if (!month || !type) {
      return NextResponse.json({ error: 'month and type required' }, { status: 400 });
    }

    const rows = type === 'planned'
      ? await sql`
          SELECT *
          FROM planned_expenses
          WHERE user_id = ${auth.user.id} AND month = ${month}
          ORDER BY created_at ASC
        `
      : await sql`
          SELECT ae.*, eg.name AS epic_goal_name
          FROM actual_expenses ae
          LEFT JOIN epic_goals eg
            ON eg.id = ae.epic_goal_id AND eg.user_id = ae.user_id
          WHERE ae.user_id = ${auth.user.id} AND ae.month = ${month}
          ORDER BY ae.date DESC, ae.created_at DESC
        `;

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const body = await req.json();
    const type = typeof body.type === 'string' ? body.type : '';
    const id = typeof body.id === 'string' ? body.id : '';
    const month = typeof body.month === 'string' ? body.month : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const amount = Number(body.amount || 0);
    const category = typeof body.category === 'string' ? body.category : 'other';
    const notes = typeof body.notes === 'string' ? body.notes : '';
    const date = typeof body.date === 'string' ? body.date : null;
    const epicGoalId = typeof body.epic_goal_id === 'string' && body.epic_goal_id.trim()
      ? body.epic_goal_id.trim()
      : null;

    if (!id || !month || !name || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'بيانات المصروف غير مكتملة' }, { status: 400 });
    }

    if (type === 'planned') {
      await sql`
        INSERT INTO planned_expenses (id, user_id, month, name, amount, category, notes)
        VALUES (${id}, ${auth.user.id}, ${month}, ${name}, ${amount}, ${category}, ${notes})
      `;
    } else if (type === 'actual') {
      if (epicGoalId) {
        const goalRows = await sql`
          SELECT id, name
          FROM epic_goals
          WHERE id = ${epicGoalId} AND user_id = ${auth.user.id}
          LIMIT 1
        `;

        if (!goalRows.length) {
          return NextResponse.json({ error: 'الهدف الملحمي غير موجود' }, { status: 400 });
        }

        const goalTotals = await getEpicGoalTotals(sql, auth.user.id, epicGoalId);
        if (amount > goalTotals.currentBalance) {
          return NextResponse.json({
            error: `رصيد الهدف "${goalRows[0].name}" غير كافٍ لهذا المصروف`,
          }, { status: 400 });
        }
      }

      await sql`
        INSERT INTO actual_expenses (id, user_id, month, name, amount, category, notes, date, epic_goal_id)
        VALUES (${id}, ${auth.user.id}, ${month}, ${name}, ${amount}, ${category}, ${notes}, ${date}, ${epicGoalId})
      `;
    } else {
      return NextResponse.json({ error: 'type غير صالح' }, { status: 400 });
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
    const type = searchParams.get('type');

    if (!id || !type) {
      return NextResponse.json({ error: 'id and type required' }, { status: 400 });
    }

    if (type === 'planned') {
      await sql`DELETE FROM planned_expenses WHERE id = ${id} AND user_id = ${auth.user.id}`;
    } else if (type === 'actual') {
      await sql`DELETE FROM actual_expenses WHERE id = ${id} AND user_id = ${auth.user.id}`;
    } else {
      return NextResponse.json({ error: 'type غير صالح' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
