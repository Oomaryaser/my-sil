'use client';

import { useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { buildHabitSummary, getHabitColor } from '@/lib/habits';
import { HABIT_ICON_OPTIONS, normalizeIconName } from '@/lib/icons';
import { Habit, formatNum } from '@/lib/types';

interface Props {
  month: string;
  habits: Habit[];
  onRefresh: () => Promise<unknown> | void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function HabitsSection({ month, habits, onRefresh, showToast }: Props) {
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('sparkles');
  const [color, setColor] = useState('#4f9cf9');
  const [notes, setNotes] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const summary = buildHabitSummary(month, habits);
  const todayKey = new Date().toISOString().slice(0, 10);

  const addHabit = async () => {
    if (!name.trim()) {
      showToast('اكتب اسم العادة أولاً', 'error');
      return;
    }

    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `habit_${Date.now()}`,
          month,
          name: name.trim(),
          icon: icon.trim() || 'sparkles',
          color,
          notes: notes.trim(),
        }),
      });

      if (!res.ok) throw new Error();

      setName('');
      setIcon('sparkles');
      setColor('#4f9cf9');
      setNotes('');
      setShowAddHabit(false);
      showToast('تم إضافة العادة');
      await onRefresh();
    } catch {
      showToast('خطأ في حفظ العادة', 'error');
    }
  };

  const toggleHabit = async (habitId: string, date: string) => {
    const key = `${habitId}_${date}`;
    setBusyKey(key);

    try {
      const res = await fetch('/api/habits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId, month, date }),
      });

      if (!res.ok) throw new Error();

      await onRefresh();
    } catch {
      showToast('تعذر تحديث الإنجاز', 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const deleteHabit = async (habitId: string) => {
    try {
      const res = await fetch(`/api/habits?id=${habitId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();

      showToast('تم حذف العادة');
      await onRefresh();
    } catch {
      showToast('تعذر حذف العادة', 'error');
    }
  };

  return (
    <div className="habits-section">
      <div className="cards-grid habits-cards">
        <div className="stat-card blue">
          <div className="stat-label">عدد العادات</div>
          <div className="stat-value blue">{summary.totalHabits}</div>
          <div className="stat-sub">{summary.trackedDaysCount} يوم محسوب هذا الشهر</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">إنجازات الشهر</div>
          <div className="stat-value green">{formatNum(summary.totalCompletions)}</div>
          <div className="stat-sub">من أصل {formatNum(summary.possibleCompletions)}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">متوسط الالتزام</div>
          <div className="stat-value purple">{summary.completionRate}%</div>
          <div className="stat-sub">{summary.averagePerDay} إنجاز يومياً</div>
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${summary.completionRate}%`, background: 'var(--green)' }} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">أفضل أسبوع</div>
          <div className="stat-value" style={{ color: 'var(--orange)' }}>
            {summary.bestWeek ? `${summary.bestWeek.rate}%` : '0%'}
          </div>
          <div className="stat-sub">
            {summary.bestWeek ? `${summary.bestWeek.label} (${summary.bestWeek.startDay}-${summary.bestWeek.endDay})` : 'ابدأ بتسجيل أول عادة'}
          </div>
        </div>
      </div>

      <div className="habits-insights">
        <div className="habit-insight-card">
          <div className="habit-insight-label">أفضل عادة</div>
          <div className="habit-insight-value">
            {summary.bestHabit ? `${summary.bestHabit.icon} ${summary.bestHabit.name}` : 'لا يوجد'}
          </div>
          <div className="habit-insight-sub">
            {summary.bestHabit ? `${summary.bestHabit.rate}% التزام` : 'أضف عادة لبدء التحليل'}
          </div>
        </div>
        <div className="habit-insight-card">
          <div className="habit-insight-label">تحتاج متابعة</div>
          <div className="habit-insight-value">
            {summary.weakestHabit ? `${summary.weakestHabit.icon} ${summary.weakestHabit.name}` : 'لا يوجد'}
          </div>
          <div className="habit-insight-sub">
            {summary.weakestHabit ? `${summary.weakestHabit.rate}% فقط حتى الآن` : 'كل شيء جاهز'}
          </div>
        </div>
        <div className="habit-insight-card">
          <div className="habit-insight-label">أيام كاملة</div>
          <div className="habit-insight-value">{summary.perfectDays}</div>
          <div className="habit-insight-sub">أيام أتممت فيها كل العادات</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="title-with-icon">
            <AppIcon name="habits" size={18} />
            <span>إدارة العادات</span>
          </h3>
          <button className="btn btn-primary btn-sm btn-with-icon" onClick={() => setShowAddHabit((open) => !open)}>
            <AppIcon name={showAddHabit ? 'close' : 'plus'} size={14} />
            <span>{showAddHabit ? 'إلغاء' : 'إضافة عادة'}</span>
          </button>
        </div>

        {showAddHabit && (
          <div className="habits-form">
            <div className="form-row triple">
              <div className="form-group">
                <label>اسم العادة *</label>
                <input
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثل: قراءة 20 دقيقة"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>الأيقونة</label>
                <select
                  className="form-control"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                >
                  {HABIT_ICON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>اللون</label>
                <input
                  type="color"
                  className="form-control habit-color-input"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>ملاحظات</label>
                <input
                  className="form-control"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اختياري"
                />
              </div>
              <div className="form-group habit-form-actions">
                <button className="btn btn-primary btn-with-icon" onClick={addHabit}>
                  <AppIcon name="save" size={16} />
                  <span>حفظ العادة</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="panel-body">
          {habits.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="habits" size={28} /></div>
              <p>لا توجد عادات بعد. أضف عاداتك ثم ابدأ التتبع اليومي والإحصائيات الأسبوعية.</p>
            </div>
          ) : (
            <div className="habit-tracker-wrap">
              <div className="habit-tracker" role="table" aria-label="متابعة العادات">
                <div
                  className="habit-row habit-week-row"
                  style={{ gridTemplateColumns: `220px repeat(${summary.dailyStats.length}, minmax(44px, 1fr))` }}
                >
                  <div className="habit-name-cell sticky">عاداتي</div>
                  {summary.weeklyStats.map((week) => (
                    <div key={week.label} className={`habit-week-cell ${week.status}`} style={{ gridColumn: `span ${week.daysCount}` }}>
                      <strong>{week.label}</strong>
                      <span>{week.startDay}-{week.endDay}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="habit-row habit-head-row"
                  style={{ gridTemplateColumns: `220px repeat(${summary.dailyStats.length}, minmax(44px, 1fr))` }}
                >
                  <div className="habit-name-cell sticky muted">العادة</div>
                  {summary.dailyStats.map((day) => (
                    <div key={day.date} className={`habit-day-head ${day.isFuture ? 'future' : ''}`}>
                      <span>{day.weekdayLabel}</span>
                      <strong>{day.dayNumber}</strong>
                    </div>
                  ))}
                </div>

                {habits.map((habit, index) => {
                  const habitRate = summary.habitRates.find((item) => item.habitId === habit.id);
                  const completedSet = new Set((habit.entries || []).map((entry) => String(entry.date).slice(0, 10)));
                  const colorValue = getHabitColor(index, habit.color);

                  return (
                    <div
                      key={habit.id}
                      className="habit-row"
                      style={{ gridTemplateColumns: `220px repeat(${summary.dailyStats.length}, minmax(44px, 1fr))` }}
                    >
                      <div className="habit-name-cell sticky">
                        <div className="habit-name-main">
                          <span className="habit-badge" style={{ background: `${colorValue}20`, color: colorValue }}>
                            <AppIcon name={normalizeIconName(habit.icon, 'sparkles')} size={18} />
                          </span>
                          <div className="habit-name-meta">
                            <strong>{habit.name}</strong>
                            <span>{habitRate ? `${habitRate.rate}%` : '0%'}</span>
                          </div>
                        </div>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteHabit(habit.id)}>
                          <AppIcon name="trash" size={14} />
                        </button>
                      </div>

                      {summary.dailyStats.map((day) => {
                        const done = completedSet.has(day.date);
                        const disabled = day.date > todayKey;
                        const cellKey = `${habit.id}_${day.date}`;

                        return (
                          <button
                            key={day.date}
                            className={`habit-check ${done ? 'done' : ''} ${day.isFuture ? 'future' : ''}`}
                            onClick={() => toggleHabit(habit.id, day.date)}
                            disabled={disabled || busyKey === cellKey}
                            aria-label={`${habit.name} ${day.dayNumber}`}
                            title={`${habit.name} - ${day.dayNumber}`}
                            style={{
                              borderColor: done ? colorValue : undefined,
                              background: done ? `${colorValue}22` : undefined,
                              color: done ? colorValue : undefined,
                            }}
                          >
                            {busyKey === cellKey ? '...' : done ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                <div
                  className="habit-row habit-footer-row"
                  style={{ gridTemplateColumns: `220px repeat(${summary.dailyStats.length}, minmax(44px, 1fr))` }}
                >
                  <div className="habit-name-cell sticky muted">نسبة اليوم</div>
                  {summary.dailyStats.map((day) => (
                    <div key={day.date} className={`habit-footer-cell ${day.isFuture ? 'future' : ''}`}>
                      {day.total > 0 && day.isTracked ? `${day.rate}%` : '-'}
                    </div>
                  ))}
                </div>

                <div
                  className="habit-row habit-footer-row"
                  style={{ gridTemplateColumns: `220px repeat(${summary.dailyStats.length}, minmax(44px, 1fr))` }}
                >
                  <div className="habit-name-cell sticky muted">تم</div>
                  {summary.dailyStats.map((day) => (
                    <div key={day.date} className={`habit-footer-cell ${day.isFuture ? 'future' : ''}`}>
                      {day.isTracked ? day.completed : '-'}
                    </div>
                  ))}
                </div>

                <div
                  className="habit-row habit-footer-row"
                  style={{ gridTemplateColumns: `220px repeat(${summary.dailyStats.length}, minmax(44px, 1fr))` }}
                >
                  <div className="habit-name-cell sticky muted">متبقي</div>
                  {summary.dailyStats.map((day) => (
                    <div key={day.date} className={`habit-footer-cell ${day.isFuture ? 'future' : ''}`}>
                      {day.isTracked ? day.remaining : '-'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>إحصائيات نهاية الأسبوع والشهر</h3>
        </div>
        <div className="panel-body">
          {habits.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="chart" size={28} /></div>
              <p>ستظهر هنا الإحصائيات الأسبوعية والشهرية بمجرد بدء تسجيل العادات.</p>
            </div>
          ) : (
            <>
              <div className="habit-week-stats">
                {summary.weeklyStats.map((week) => (
                  <div key={week.label} className={`habit-week-stat ${week.status}`}>
                    <div className="habit-week-stat-head">
                      <strong>{week.label}</strong>
                      <span>{week.startDay}-{week.endDay}</span>
                    </div>
                    <div className="habit-week-stat-rate">{week.total > 0 ? `${week.rate}%` : '0%'}</div>
                    <div className="habit-week-stat-sub">
                      {week.completed} من {week.total} إنجاز
                    </div>
                    <div className="progress-wrap">
                      <div className="progress-bar" style={{ width: `${week.rate}%`, background: week.rate >= 80 ? 'var(--green)' : week.rate >= 50 ? 'var(--orange)' : 'var(--accent)' }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="habit-trend">
                {summary.dailyStats.map((day) => (
                  <div key={day.date} className="habit-trend-col" title={`${day.dayNumber}: ${day.rate}%`}>
                    <div
                      className={`habit-trend-bar ${day.isFuture ? 'future' : ''}`}
                      style={{ height: `${Math.max(day.rate, day.isTracked ? 8 : 4)}%` }}
                    />
                    <span>{day.dayNumber}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
