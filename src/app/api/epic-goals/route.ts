import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();

    const goals = await sql`
      SELECT
        g.*,
        COALESCE(saved.saved_total, 0) AS saved_total,
        COALESCE(spent.spent_total, 0) AS spent_total
      FROM epic_goals g
      LEFT JOIN (
        SELECT epic_goal_id, SUM(amount) AS saved_total
        FROM epic_goal_allocations
        WHERE user_id = ${auth.user.id}
        GROUP BY epic_goal_id
      ) saved
        ON saved.epic_goal_id = g.id
      LEFT JOIN (
        SELECT epic_goal_id, SUM(amount) AS spent_total
        FROM actual_expenses
        WHERE user_id = ${auth.user.id} AND epic_goal_id IS NOT NULL
        GROUP BY epic_goal_id
      ) spent
        ON spent.epic_goal_id = g.id
      WHERE g.user_id = ${auth.user.id}
      ORDER BY g.created_at ASC
    `;

    const allocations = await sql`
      SELECT *
      FROM epic_goal_allocations
      WHERE user_id = ${auth.user.id}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(
      goals.map((goal) => {
        const savedTotal = Number(goal.saved_total ?? 0);
        const spentTotal = Number(goal.spent_total ?? 0);

        return {
          ...goal,
          saved_total: savedTotal,
          spent_total: spentTotal,
          current_balance: savedTotal + spentTotal,
          allocations: allocations.filter((allocation) => allocation.epic_goal_id === goal.id),
        };
      }),
    );
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
    const id = typeof body.id === 'string' ? body.id : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const targetAmount = Number(body.target_amount || 0);
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (!id || !name) {
      return NextResponse.json({ error: 'اسم الهدف مطلوب' }, { status: 400 });
    }

    if (Number.isNaN(targetAmount) || targetAmount < 0) {
      return NextResponse.json({ error: 'المبلغ المستهدف يجب أن يكون صفراً أو أكثر' }, { status: 400 });
    }

    await sql`
      INSERT INTO epic_goals (id, user_id, name, target_amount, notes)
      VALUES (${id}, ${auth.user.id}, ${name}, ${targetAmount}, ${notes})
    `;

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

    const [allocationRow] = await sql`
      SELECT COUNT(*) AS count
      FROM epic_goal_allocations
      WHERE user_id = ${auth.user.id} AND epic_goal_id = ${id}
    `;

    const [expenseRow] = await sql`
      SELECT COUNT(*) AS count
      FROM actual_expenses
      WHERE user_id = ${auth.user.id} AND epic_goal_id = ${id}
    `;

    if (Number(allocationRow?.count ?? 0) > 0 || Number(expenseRow?.count ?? 0) > 0) {
      return NextResponse.json({
        error: 'لا يمكن حذف الهدف لأنه يحتوي على تحويلات أو مصاريف مرتبطة',
      }, { status: 400 });
    }

    await sql`
      DELETE FROM epic_goals
      WHERE id = ${id} AND user_id = ${auth.user.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
