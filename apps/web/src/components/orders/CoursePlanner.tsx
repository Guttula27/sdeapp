import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ChevronDown, ListOrdered, Plus, Save } from 'lucide-react';
import api from '../../services/api';

/* Groups order items into courses (Starter / Main / Dessert …) that
   flow to the kitchen sequentially: course 2 stays held until every
   item in course 1 is SERVED. */
export default function CoursePlanner({
  order,
  onSaved,
  compact = false,
}: {
  order: any;
  onSaved: (updated: any) => void;
  compact?: boolean;
}) {
  const initial = useMemo(() => {
    const labels: Record<string, string> = { ...(order.sequenceLabels || {}) };
    const items: Record<string, number | null> = {};
    let maxCourse = 0;
    for (const it of order.items || []) {
      items[it.id] = it.sequenceNumber ?? null;
      if (it.sequenceNumber && it.sequenceNumber > maxCourse) maxCourse = it.sequenceNumber;
    }
    return { labels, items, courseCount: Math.max(1, maxCourse) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.activeSequence, order.sequenceLabels]);

  const [open, setOpen] = useState<boolean>(false);
  const [labels, setLabels] = useState<Record<string, string>>(initial.labels);
  const [seq, setSeq] = useState<Record<string, number | null>>(initial.items);
  const [courseCount, setCourseCount] = useState<number>(initial.courseCount);
  const [saving, setSaving] = useState(false);

  // Re-sync if the parent feeds a fresh order (e.g. after socket update)
  useEffect(() => {
    setLabels(initial.labels);
    setSeq(initial.items);
    setCourseCount(initial.courseCount);
  }, [initial]);

  const hasSequencing = (order.items || []).some((i: any) => i.sequenceNumber != null);
  const activeLabel = order.sequenceLabels?.[String(order.activeSequence)] || `Course ${order.activeSequence}`;

  const save = async () => {
    setSaving(true);
    try {
      const payloadItems = (order.items || []).map((it: any) => ({
        itemId: it.id,
        sequenceNumber: seq[it.id] ?? null,
      }));
      const cleaned: Record<string, string> = {};
      for (let i = 1; i <= courseCount; i++) {
        const v = (labels[String(i)] || '').trim();
        if (v) cleaned[String(i)] = v;
      }
      const { data } = await api.patch(`/outlets/${order.outletId}/orders/${order.id}/sequences`, {
        items: payloadItems,
        labels: Object.keys(cleaned).length ? cleaned : null,
      });
      toast.success('Courses saved');
      onSaved(data.data);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save courses');
    } finally {
      setSaving(false);
    }
  };

  const clearAll = () => {
    const cleared: Record<string, number | null> = {};
    for (const it of order.items || []) cleared[it.id] = null;
    setSeq(cleared);
    setLabels({});
    setCourseCount(1);
  };

  return (
    <div className={clsx('rounded-xl border border-slate-200 bg-white', compact && 'rounded-lg')}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'w-full flex items-center gap-2 text-left hover:bg-slate-50 rounded-xl',
          compact ? 'px-2.5 py-1.5' : 'px-4 py-2.5',
        )}
      >
        <ListOrdered size={compact ? 12 : 14} className="text-indigo-500" />
        <span className={clsx('font-bold text-slate-700', compact ? 'text-[11px]' : 'text-sm')}>
          Courses
        </span>
        {hasSequencing ? (
          <span className={clsx(
            'font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100',
            compact ? 'text-[9px]' : 'text-[10px]',
          )}>
            Now serving · {activeLabel}
          </span>
        ) : (
          <span className={clsx('text-slate-400', compact ? 'text-[9px]' : 'text-[10px]')}>
            Not sequenced
          </span>
        )}
        <ChevronDown
          size={compact ? 12 : 14}
          className={clsx('ml-auto text-slate-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className={clsx('border-t border-slate-100 space-y-3', compact ? 'px-2.5 py-2' : 'px-4 py-3')}>
          <p className={clsx('text-slate-500', compact ? 'text-[10px]' : 'text-[11px]')}>
            Group items into courses. The kitchen sees course 1 first; course 2 unlocks once every item in course 1 is SERVED. Already-cooking items can't be re-sequenced.
          </p>

          <div className="space-y-2">
            {Array.from({ length: courseCount }, (_, i) => i + 1).map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className={clsx(
                  'font-bold uppercase tracking-wider text-slate-500 shrink-0',
                  compact ? 'text-[9px] w-14' : 'text-[10px] w-16',
                )}>
                  Course {c}
                </span>
                <input
                  value={labels[String(c)] || ''}
                  onChange={(e) => setLabels((p) => ({ ...p, [String(c)]: e.target.value }))}
                  placeholder={c === 1 ? 'e.g. Starter' : c === 2 ? 'e.g. Main' : 'Name (optional)'}
                  className={clsx('input', compact ? 'text-xs py-1' : 'text-sm py-1.5')}
                />
                {c === order.activeSequence && hasSequencing && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                    ACTIVE
                  </span>
                )}
              </div>
            ))}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCourseCount((n) => n + 1)}
                className="text-[11px] font-semibold text-brand-800 hover:text-brand-900 inline-flex items-center gap-1"
              >
                <Plus size={11} /> Add a course
              </button>
              {courseCount > 1 && (
                <button
                  onClick={() => {
                    const remove = courseCount;
                    setCourseCount((n) => n - 1);
                    setSeq((p) => {
                      const next = { ...p };
                      for (const k of Object.keys(next)) {
                        if (next[k] === remove) next[k] = null;
                      }
                      return next;
                    });
                    setLabels((p) => {
                      const next = { ...p };
                      delete next[String(remove)];
                      return next;
                    });
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                >
                  Remove last course
                </button>
              )}
              <button onClick={clearAll} className="text-[11px] font-semibold text-slate-400 hover:text-red-500 ml-auto">
                Clear all
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Assign items</p>
            {(order.items || []).map((it: any) => {
              const locked = it.status !== 'PENDING' && (seq[it.id] ?? null) === (it.sequenceNumber ?? null);
              return (
                <div key={it.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">
                    {it.quantity}× {it.item?.name}{it.variant ? ` (${it.variant.name})` : ''}
                  </span>
                  <select
                    value={seq[it.id] == null ? '' : String(seq[it.id])}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      setSeq((p) => ({ ...p, [it.id]: v }));
                    }}
                    disabled={it.status !== 'PENDING' && it.status !== 'PENDING_VERIFICATION'}
                    title={
                      it.status !== 'PENDING' && it.status !== 'PENDING_VERIFICATION'
                        ? `Already ${it.status} — can't reassign`
                        : undefined
                    }
                    className="input text-xs py-1 w-28 disabled:opacity-60"
                  >
                    <option value="">None</option>
                    {Array.from({ length: courseCount }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c}>
                        {labels[String(c)]?.trim() || `Course ${c}`}
                      </option>
                    ))}
                  </select>
                  {locked && it.sequenceNumber != null && (
                    <span className="text-[9px] text-slate-400 shrink-0">locked</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-xs">
              <Save size={12} /> {saving ? 'Saving…' : 'Save courses'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
