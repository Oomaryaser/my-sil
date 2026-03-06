'use client';

import { FormEvent, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { TodoItem, formatDate } from '@/lib/types';

interface Props {
  todos: TodoItem[];
  loading: boolean;
  onRefresh: () => Promise<unknown>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function TodoBoard({ todos, loading, onRefresh, showToast }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = todos.filter((todo) => !todo.completed);
  const completed = todos.filter((todo) => todo.completed);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (title.trim().length < 2) {
      showToast('اكتب عنوان المهمة بشكل أوضح', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim(),
          due_date: dueDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'تعذر إضافة المهمة' }));
        throw new Error(data.error || 'تعذر إضافة المهمة');
      }

      setTitle('');
      setNotes('');
      setDueDate('');
      showToast('تمت إضافة المهمة');
      await onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر إضافة المهمة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTodo = async (item: TodoItem) => {
    setBusyId(item.id);
    try {
      const res = await fetch('/api/todos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          completed: !item.completed,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'تعذر تحديث المهمة' }));
        throw new Error(data.error || 'تعذر تحديث المهمة');
      }

      await onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر تحديث المهمة', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const deleteTodo = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/todos?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'تعذر حذف المهمة' }));
        throw new Error(data.error || 'تعذر حذف المهمة');
      }

      showToast('تم حذف المهمة');
      await onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر حذف المهمة', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="todo-layout">
      <div className="panel">
        <div className="panel-header">
          <h3 className="title-with-icon">
            <AppIcon name="plus" size={18} />
            <span>إضافة مهمة جديدة</span>
          </h3>
        </div>
        <div className="panel-body">
          <form className="todo-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label>عنوان المهمة</label>
              <input
                className="form-control"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="مثل: مراجعة مصاريف الأسبوع"
              />
            </div>

            <div className="form-group">
              <label>الملاحظات</label>
              <textarea
                className="form-control requests-textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="تفاصيل إضافية (اختياري)"
              />
            </div>

            <div className="form-group">
              <label>تاريخ الاستحقاق (اختياري)</label>
              <input
                className="form-control"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>

            <button className="btn btn-primary btn-with-icon" type="submit" disabled={submitting}>
              <AppIcon name={submitting ? 'clock' : 'plus'} size={16} />
              <span>{submitting ? 'جارٍ الإضافة...' : 'إضافة المهمة'}</span>
            </button>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="title-with-icon">
            <AppIcon name="todo" size={18} />
            <span>قائمة المهام</span>
          </h3>
          <span className="status-chip active">
            {pending.length} غير منجزة
          </span>
        </div>
        <div className="panel-body">
          {loading ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="clock" size={28} /></div>
              <p>جارٍ تحميل المهام...</p>
            </div>
          ) : todos.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="todo" size={28} /></div>
              <p>لا توجد مهام بعد. أضف أول مهمة للبدء.</p>
            </div>
          ) : (
            <div className="todo-list">
              {pending.map((item) => (
                <article key={item.id} className="todo-item">
                  <div className="todo-item-main">
                    <button
                      className="todo-toggle"
                      onClick={() => toggleTodo(item)}
                      disabled={busyId === item.id}
                      type="button"
                      aria-label="تحديد المهمة كمكتملة"
                    >
                      <AppIcon name={busyId === item.id ? 'clock' : 'check'} size={14} />
                    </button>
                    <div className="todo-content">
                      <h4>{item.title}</h4>
                      {item.notes ? <p>{item.notes}</p> : null}
                      {item.due_date ? (
                        <span className="todo-date">
                          <AppIcon name="calendar" size={13} />
                          <span>الاستحقاق: {formatDate(String(item.due_date).slice(0, 10))}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteTodo(item.id)}
                    disabled={busyId === item.id}
                  >
                    <AppIcon name="trash" size={14} />
                  </button>
                </article>
              ))}

              {completed.length > 0 ? (
                <div className="todo-completed-wrap">
                  <div className="todo-completed-title">
                    <AppIcon name="check" size={14} />
                    <span>مهام مكتملة ({completed.length})</span>
                  </div>
                  {completed.map((item) => (
                    <article key={item.id} className="todo-item completed">
                      <div className="todo-item-main">
                        <button
                          className="todo-toggle"
                          onClick={() => toggleTodo(item)}
                          disabled={busyId === item.id}
                          type="button"
                          aria-label="إرجاع المهمة لغير مكتملة"
                        >
                          <AppIcon name={busyId === item.id ? 'clock' : 'check'} size={14} />
                        </button>
                        <div className="todo-content">
                          <h4>{item.title}</h4>
                          {item.notes ? <p>{item.notes}</p> : null}
                        </div>
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteTodo(item.id)}
                        disabled={busyId === item.id}
                      >
                        <AppIcon name="trash" size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
