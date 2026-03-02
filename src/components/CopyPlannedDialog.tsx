'use client';

import { useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { Expense, CAT_ICONS, CAT_NAMES, formatNum, getMonthName } from '@/lib/types';

interface Props {
  fromMonth: string;
  toMonth: string;
  expenses: Expense[];
  onConfirm: (expenses: Expense[]) => Promise<void>;
  onSkip: () => void;
}

export default function CopyPlannedDialog({ fromMonth, toMonth, expenses, onConfirm, onSkip }: Props) {
  const [items, setItems] = useState<Expense[]>(expenses.map(e => ({ ...e })));
  const [loading, setLoading] = useState(false);

  const updateAmount = (id: string, val: string) => {
    setItems(prev => prev.map(e => e.id === id ? { ...e, amount: parseFloat(val) || 0 } : e));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(e => e.id !== id));
  };

  const total = items.reduce((s, e) => s + Number(e.amount), 0);

  const handleConfirm = async () => {
    if (items.length === 0) { onSkip(); return; }
    setLoading(true);
    await onConfirm(items);
    setLoading(false);
  };

  return (
    <div className="modal-overlay open">
      <div className="modal fade-in" style={{ maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="title-with-icon">
              <AppIcon name="copy" size={18} />
              <span>مصاريف شهر {getMonthName(toMonth)}</span>
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              نسخ من {getMonthName(fromMonth)} — راجع وعدّل قبل التأكيد
            </p>
          </div>
        </div>

        {/* Items list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 4px' }}>
          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <div className="icon"><AppIcon name="planned" size={28} /></div>
              <p>حذفت كل البنود — سيبدأ الشهر بلا مصاريف متوقعة</p>
            </div>
          ) : items.map(e => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 4px', borderBottom: '1px solid var(--border)'
            }}>
              {/* Icon */}
              <div className={`expense-icon cat-${e.category}`} style={{ flexShrink: 0 }}>
                <AppIcon name={CAT_ICONS[e.category] || 'other'} size={18} />
              </div>

              {/* Name + category */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{CAT_NAMES[e.category] || 'أخرى'}</div>
              </div>

              {/* Amount input */}
              <input
                type="number"
                value={e.amount}
                onChange={ev => updateAmount(e.id, ev.target.value)}
                style={{
                  width: 90, padding: '6px 10px', background: 'var(--surface2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', textAlign: 'center'
                }}
              />

              {/* Delete */}
              <button
                className="btn btn-danger btn-sm"
                onClick={() => removeItem(e.id)}
                style={{ flexShrink: 0 }}
              >
                <AppIcon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Total */}
        {items.length > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 4px', borderTop: '1px solid var(--border)',
            fontSize: 14, fontWeight: 700
          }}>
            <span style={{ color: 'var(--muted)' }}>الإجمالي</span>
            <span style={{ color: 'var(--accent)' }}>{formatNum(total)}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            className="btn btn-primary btn-with-icon"
            style={{ flex: 1 }}
            onClick={handleConfirm}
            disabled={loading}
          >
            <AppIcon name={loading ? 'clock' : 'copy'} size={16} />
            <span>{loading ? 'جارٍ الحفظ…' : `تأكيد (${items.length} بند)`}</span>
          </button>
          <button className="btn btn-ghost btn-with-icon" onClick={onSkip} disabled={loading}>
            <AppIcon name="close" size={16} />
            <span>تخطّي</span>
          </button>
        </div>
      </div>
    </div>
  );
}
