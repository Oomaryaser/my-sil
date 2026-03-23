import { getDB } from '@/lib/db';

type SQL = ReturnType<typeof getDB>;

export async function getEpicGoalTotals(sql: SQL, userId: string, goalId: string) {
  const [savedRow] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM epic_goal_allocations
    WHERE user_id = ${userId} AND epic_goal_id = ${goalId}
  `;

  const [spentRow] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM actual_expenses
    WHERE user_id = ${userId} AND epic_goal_id = ${goalId}
  `;

  const savedTotal = Number(savedRow?.total ?? 0);
  const spentTotal = Number(spentRow?.total ?? 0);

  return {
    savedTotal,
    spentTotal,
    currentBalance: savedTotal + spentTotal,
  };
}

export async function getMonthGoalAvailability(sql: SQL, userId: string, month: string) {
  const [incomeRow] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM income_payments
    WHERE user_id = ${userId} AND month = ${month}
  `;

  const [salaryRow] = await sql`
    SELECT COALESCE(total, 0) AS total
    FROM salaries
    WHERE user_id = ${userId} AND month = ${month}
    LIMIT 1
  `;

  const [actualRow] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM actual_expenses
    WHERE user_id = ${userId} AND month = ${month}
  `;

  const [allocationRow] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM epic_goal_allocations
    WHERE user_id = ${userId} AND month = ${month}
  `;

  const [adjustmentRow] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM surplus_adjustments
    WHERE user_id = ${userId} AND month = ${month}
  `;

  const paidIncome = Number(incomeRow?.total ?? 0);
  const salaryIncome = Number(salaryRow?.total ?? 0);
  const actualTotal = Number(actualRow?.total ?? 0);
  const allocatedTotal = Number(allocationRow?.total ?? 0);
  const adjustmentTotal = Number(adjustmentRow?.total ?? 0);
  const incomeTotal = paidIncome || salaryIncome;

  return {
    incomeTotal,
    actualTotal,
    allocatedTotal,
    adjustmentTotal,
    availableToAllocate: incomeTotal - actualTotal - allocatedTotal - adjustmentTotal,
  };
}
