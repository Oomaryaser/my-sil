'use client';

import { useEffect, useState } from 'react';
import { ExpenseType } from '@/lib/types';

interface Props {
  isOpen: boolean;
  type: ExpenseType;
  onClose: () => void;
  onSave: (data: {
    id: string;
    name: string;
    amount: number;
    category: string;
    notes: string;
    date?: string;
    type: ExpenseType;
  }) => void;
}

export default function ExpenseModal({ isOpen, type, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (isOpen) {
      setName(''); setAmount(''); setCategory('food'); setNotes('');
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    if (!name.trim() || !amount) { alert('أدخل الاسم والمبلغ'); return; }
    onSave({
      id: Date.now().toString(),
      name: name.trim(),
      amount: parseFloat(amount),
      category,
      notes,
      date: type === 'actual' ? date : undefined,
      type,
    });
  };

  return (
    <div className={`modal-overlay${isOpen ? ' open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal fade-in">
        <div className="modal-header">
          <h3>{type === 'planned' ? '📋 إضافة مصروف متوقع' : '💸 إضافة مصروف فعلي'}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>اسم المصروف *</label>
            <input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="مثل: فاتورة الكهرباء" autoFocus />
          </div>
          <div className="form-group">
            <label>المبلغ *</label>
            <input type="number" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} placeholder="مثل: 150" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>الفئة</label>
            <select className="form-control" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="food">🍔 طعام ومشروبات</option>
              <option value="transport">🚗 مواصلات</option>
              <option value="bills">⚡ فواتير</option>
              <option value="shopping">🛍️ تسوق</option>
              <option value="health">💊 صحة</option>
              <option value="entertainment">🎬 ترفيه</option>
              <option value="gift">🎁 هدية</option>
              <option value="charity">🤲 هبة / صدقة</option>
              <option value="savings">🏦 ادخار</option>
              <option value="family">👨‍👩‍👧 عائلة</option>
              <option value="other">📦 أخرى</option>
            </select>
          </div>
          {type === 'actual' && (
            <div className="form-group">
              <label>التاريخ</label>
              <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          )}
        </div>

        <div className="form-row single">
          <div className="form-group">
            <label>ملاحظات</label>
            <input className="form-control" value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي تفاصيل إضافية..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 حفظ</button>
        </div>
      </div>
    </div>
  );
}
