'use client';

import { CAT_ICONS, CAT_NAMES, Expense, ExpenseType, formatNum } from '@/lib/types';

interface Props {
  expense: Expense;
  type: ExpenseType;
  onDelete: (id: string, type: ExpenseType) => void;
}

export default function ExpenseItem({ expense, type, onDelete }: Props) {
  const icon = CAT_ICONS[expense.category] || '📦';
  const catName = CAT_NAMES[expense.category] || 'أخرى';
  const isActual = type === 'actual';

  return (
    <div className="expense-item">
      <div className="expense-left">
        <div className={`expense-icon cat-${expense.category}`}>{icon}</div>
        <div>
          <div className="expense-name">{expense.name}</div>
          <div className="expense-cat">
            {catName}
            {isActual && expense.date ? ` · ${expense.date}` : ''}
            {expense.notes ? ` · ${expense.notes}` : ''}
          </div>
        </div>
      </div>
      <div className="expense-right">
        <span className="expense-amount" style={{ color: isActual ? 'var(--red)' : 'var(--accent)' }}>
          {formatNum(Number(expense.amount))}
        </span>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(expense.id, type)}>
          🗑️
        </button>
      </div>
    </div>
  );
}
