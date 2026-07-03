import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { MessageSquare, Star, IndianRupee, Reply, Filter } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  replyText: string | null;
  repliedAt: string | null;
  replyBy?: { id: string; name: string } | null;
  paybackAmount: string | number | null;
  paybackPayment?: { id: string; mode: string; amount: string; status: string; createdAt: string } | null;
  customer?: { id: string; name: string; phone: string } | null;
  item?: { id: string; name: string } | null;
  orderItem?: { id: string; orderId: string; order?: { orderNumber: string; createdAt: string; totalAmount: string } };
}

// Payback mode enum + i18n key stem — labels come from t() at render time.
const PAYBACK_MODES = [
  { value: 'CASH', labelKey: 'modeCash' },
  { value: 'UPI',  labelKey: 'modeUpi' },
];

export default function FeedbackPage() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const outletId: string | undefined = user?.outletId;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyComments, setOnlyComments] = useState(false);

  const fetchReviews = useCallback(async () => {
    if (!outletId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/reviews`, {
        params: onlyComments ? { withCommentOnly: 'true' } : {},
      });
      setReviews(data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('feedback.toastLoadFail'));
    } finally {
      setLoading(false);
    }
  }, [outletId, onlyComments, t]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const stats = useMemo(() => {
    const total = reviews.length;
    const withComment = reviews.filter(r => r.comment).length;
    const replied = reviews.filter(r => r.replyText).length;
    const avg = total ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0;
    return { total, withComment, replied, avg };
  }, [reviews]);

  if (!outletId) {
    return <p className="p-6 text-sm text-slate-500">{t('feedback.outletScopedNotice')}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t('feedback.title')}</h1>
          <p className="page-subtitle">{t('feedback.subtitle')}</p>
        </div>
        <button
          onClick={() => setOnlyComments(v => !v)}
          className={clsx(
            'btn-secondary text-xs',
            onlyComments && 'bg-brand-50 text-brand-700 border-brand-200',
          )}
        >
          <Filter size={13} /> {onlyComments ? t('feedback.showingWithComment') : t('feedback.showingAll')}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t('feedback.statTotal')} value={stats.total.toString()} />
        <Stat label={t('feedback.statAvgRating')} value={stats.avg ? t('feedback.avgWithStar', { avg: stats.avg.toFixed(1) }) : '—'} />
        <Stat label={t('feedback.statWithComments')} value={stats.withComment.toString()} />
        <Stat label={t('feedback.statReplied')} value={`${stats.replied}/${stats.total || 0}`} />
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-32 animate-pulse" />)}</div>
      ) : reviews.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <MessageSquare size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">{t('feedback.emptyTitle')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('feedback.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <ReviewCard key={r.id} review={r} onChanged={fetchReviews} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</p>
      <p className="text-xl font-black text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={12}
          className={n <= value ? 'text-amber-500' : 'text-slate-200'}
          fill={n <= value ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review, onChanged }: { review: Review; onChanged: () => void }) {
  const { t } = useTranslation();
  // Edit-in-place reply state. Pre-populates with any existing reply.
  const [replyText, setReplyText] = useState(review.replyText ?? '');
  const [replyEditing, setReplyEditing] = useState(!review.replyText);
  const [savingReply, setSavingReply] = useState(false);

  const [paybackOpen, setPaybackOpen] = useState(false);
  const [paybackAmount, setPaybackAmount] = useState('');
  const [paybackMode, setPaybackMode] = useState('CASH');
  const [savingPayback, setSavingPayback] = useState(false);

  const submitReply = async () => {
    if (!replyText.trim()) { toast.error(t('feedback.toastReplyEmpty')); return; }
    setSavingReply(true);
    try {
      await api.post(`/reviews/${review.id}/reply`, { replyText: replyText.trim() });
      toast.success(t('feedback.toastReplySaved'));
      setReplyEditing(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('feedback.toastReplyFail'));
    } finally {
      setSavingReply(false);
    }
  };

  const submitPayback = async () => {
    const amt = Number(paybackAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error(t('feedback.toastPaybackPositive')); return; }
    setSavingPayback(true);
    try {
      await api.post(`/reviews/${review.id}/payback`, { amount: amt, mode: paybackMode });
      toast.success(t('feedback.toastPaybackRecorded', { amount: amt.toFixed(2) }));
      setPaybackOpen(false);
      setPaybackAmount('');
      onChanged();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('feedback.toastPaybackFail'));
    } finally {
      setSavingPayback(false);
    }
  };

  const hasPayback = !!review.paybackPayment;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Stars value={review.rating} />
            <span className="text-xs font-bold text-slate-700">{t('feedback.ratingOutOf', { n: review.rating })}</span>
            <span className="text-xs text-slate-400">·</span>
            <p className="text-sm font-bold text-slate-900 truncate">{review.item?.name}</p>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {review.customer?.name || t('feedback.guest')}
            {review.customer?.phone && <span className="text-slate-400"> · {review.customer.phone}</span>}
            <span className="text-slate-400"> · {t('feedback.orderPrefix', { number: review.orderItem?.order?.orderNumber ?? '' })}</span>
            <span className="text-slate-400"> · {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          </p>
        </div>
        {hasPayback && (
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
            {t('feedback.paybackChip', { amount: Number(review.paybackPayment!.amount).toFixed(2), mode: review.paybackPayment!.mode })}
          </span>
        )}
      </div>

      {review.comment && (
        <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 italic">
          “{review.comment}”
        </div>
      )}

      {/* Reply block */}
      <div className="rounded-xl border border-slate-100 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Reply size={12} /> {t('feedback.yourReply')}
          {review.replyText && !replyEditing && (
            <button
              onClick={() => setReplyEditing(true)}
              className="ml-auto text-[11px] text-brand-600 hover:text-brand-700 font-bold"
            >
              {t('feedback.editReply')}
            </button>
          )}
        </div>
        {replyEditing ? (
          <>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              placeholder={t('feedback.replyPlaceholder')}
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:border-brand-400 resize-none"
            />
            <div className="flex justify-end gap-2">
              {review.replyText && (
                <button
                  onClick={() => { setReplyText(review.replyText ?? ''); setReplyEditing(false); }}
                  className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded-lg"
                >
                  {t('feedback.cancel')}
                </button>
              )}
              <button
                onClick={submitReply}
                disabled={savingReply}
                className="text-xs font-bold bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
              >
                {savingReply ? t('feedback.saving') : review.replyText ? t('feedback.updateReply') : t('feedback.sendReply')}
              </button>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-700">
            <p>{review.replyText}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              {review.replyBy?.name ? `${review.replyBy.name}, ` : ''}{review.repliedAt && new Date(review.repliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        )}
      </div>

      {/* Payback block */}
      {hasPayback ? (
        <p className="text-[11px] text-emerald-700">
          {t('feedback.paybackRecordedOn', {
            date: review.paybackPayment!.createdAt
              ? new Date(review.paybackPayment!.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : '',
          })}
        </p>
      ) : paybackOpen ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
          <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
            <IndianRupee size={12} /> {t('feedback.initiatePayback')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{t('feedback.paybackAmountLabel')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paybackAmount}
                onChange={(e) => setPaybackAmount(e.target.value)}
                placeholder={t('feedback.paybackAmountPlaceholder')}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{t('feedback.paybackModeLabel')}</label>
              <select
                value={paybackMode}
                onChange={(e) => setPaybackMode(e.target.value)}
                className="input text-xs"
              >
                {PAYBACK_MODES.map(m => <option key={m.value} value={m.value}>{t(`feedback.${m.labelKey}`)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setPaybackOpen(false); setPaybackAmount(''); }}
              className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded-lg"
            >
              {t('feedback.cancel')}
            </button>
            <button
              onClick={submitPayback}
              disabled={savingPayback}
              className="text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
            >
              {savingPayback ? t('feedback.recording') : t('feedback.recordPayback')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setPaybackOpen(true)}
          className="text-[11px] font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
        >
          <IndianRupee size={11} /> {t('feedback.initiatePayback')}
        </button>
      )}
    </div>
  );
}
