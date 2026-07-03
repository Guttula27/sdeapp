import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Trans, useTranslation } from 'react-i18next';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  AlertTriangle, CheckCircle2, Clock, MessageSquare,
  IndianRupee, User, Phone, ChevronRight, X, Plus, Search, Loader2, Receipt,
} from 'lucide-react';
import { RootState } from '../../store';
import { useUserRole } from '../../hooks/useUserRole';
import ListToolbar from '../../components/common/ListToolbar';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

/* ── types ───────────────────────────────────────────────── */
type DisputeStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'CLOSED';

interface Dispute {
  id: string;
  status: DisputeStatus;
  description: string;
  claimAmount: string | null;
  resolution: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    totalAmount: string;
    customer: { id: string; name: string; phone: string } | null;
    items: Array<{ quantity: number; item: { name: string } }>;
  };
}

interface Stats {
  open: number;
  reviewing: number;
  resolved: number;
  closed: number;
  total: number;
  pendingClaimAmount: number;
}

/* ── status config ───────────────────────────────────────── */
// Palette + icon per status; `labelKey` is an i18n stem resolved via t()
// at render time so switching language re-renders the badge text.
const STATUS_CFG: Record<DisputeStatus, { badge: string; labelKey: string; icon: any; dot: string }> = {
  OPEN:      { badge: 'badge-red',    labelKey: 'labelOpen',      icon: AlertTriangle,  dot: 'bg-red-500' },
  REVIEWING: { badge: 'badge-yellow', labelKey: 'labelReviewing', icon: Clock,          dot: 'bg-yellow-500' },
  RESOLVED:  { badge: 'badge-green',  labelKey: 'labelResolved',  icon: CheckCircle2,   dot: 'bg-emerald-500' },
  CLOSED:    { badge: 'badge-slate',  labelKey: 'labelClosed',    icon: CheckCircle2,   dot: 'bg-slate-400' },
};

const NEXT_STATUSES: Record<string, DisputeStatus[]> = {
  OPEN:      ['REVIEWING', 'RESOLVED', 'CLOSED'],
  REVIEWING: ['RESOLVED', 'CLOSED'],
  RESOLVED:  ['CLOSED'],
  CLOSED:    [],
};

const FILTER_OPTIONS: (DisputeStatus | 'ALL')[] = ['ALL', 'OPEN', 'REVIEWING', 'RESOLVED', 'CLOSED'];

/* ── component ───────────────────────────────────────────── */
export default function DisputesPage() {
  const { t } = useTranslation();
  const user     = useSelector((s: RootState) => s.auth.user);
  const { tier } = useUserRole();
  const businessId = user?.businessId;
  const [businessOutlets, setBusinessOutlets] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  useEffect(() => {
    if (tier !== 'business' || !businessId) return;
    api.get(`/outlets/business/${businessId}`)
      .then((r) => {
        const list = r.data.data || [];
        setBusinessOutlets(list);
        if (!selectedOutletId && list.length) setSelectedOutletId(list[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, businessId]);
  const outletId = tier === 'business'
    ? selectedOutletId
    : (user?.outletId || 'demo-outlet');

  const [disputes, setDisputes]   = useState<Dispute[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [filter, setFilter]       = useState<DisputeStatus | 'ALL'>('ALL');
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState<'createdAt' | 'claimAmount' | 'status' | 'orderNumber'>('createdAt');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Dispute | null>(null);
  const [resolveModal, setResolveModal] = useState<{ open: boolean; dispute?: Dispute; nextStatus?: DisputeStatus }>({ open: false });
  const [resolution, setResolution]     = useState('');
  const [saving, setSaving]             = useState(false);

  const [raiseOpen, setRaiseOpen]               = useState(false);
  const [raiseOrders, setRaiseOrders]           = useState<any[]>([]);
  const [raiseOrderId, setRaiseOrderId]         = useState('');
  const [raiseDescription, setRaiseDescription] = useState('');
  const [raiseClaim, setRaiseClaim]             = useState('');
  const [raiseBillLookup, setRaiseBillLookup]   = useState('');
  const [raiseLookupBusy, setRaiseLookupBusy]   = useState(false);
  const [raiseLookupHit, setRaiseLookupHit]     = useState<any>(null);
  const [raising, setRaising]                   = useState(false);

  const fetchAll = useCallback(async () => {
    if (!outletId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        api.get(`/disputes/outlet/${outletId}${filter !== 'ALL' ? `?status=${filter}` : ''}`),
        api.get(`/disputes/outlet/${outletId}/stats`),
      ]);
      setDisputes(dRes.data.data.disputes || []);
      setStats(sRes.data.data);
    } finally {
      setLoading(false);
    }
  }, [outletId, filter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const visibleDisputes = (() => {
    const q = search.trim().toLowerCase();
    const matched = !q ? disputes : disputes.filter((d) => {
      const haystack = [
        d.order?.orderNumber,
        d.order?.customer?.name,
        d.order?.customer?.phone,
        d.description,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...matched].sort((a, b) => {
      switch (sortBy) {
        case 'claimAmount': return dir * (Number(a.claimAmount || 0) - Number(b.claimAmount || 0));
        case 'status':      return dir * a.status.localeCompare(b.status);
        case 'orderNumber': return dir * (a.order?.orderNumber || '').localeCompare(b.order?.orderNumber || '');
        case 'createdAt':
        default:            return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    });
  })();

  const outletPicker = tier === 'business' && (
    <div className="card p-3 flex items-center gap-2">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('disputes.outletLabel')}</span>
      <select
        value={selectedOutletId}
        onChange={(e) => setSelectedOutletId(e.target.value)}
        className="input py-1.5 text-sm"
        style={{ minWidth: 200 }}
      >
        {businessOutlets.length === 0 && <option value="">{t('disputes.noOutlets')}</option>}
        {businessOutlets.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );

  const [refundRequested, setRefundRequested] = useState(false);

  const openResolve = (dispute: Dispute, nextStatus: DisputeStatus) => {
    setResolveModal({ open: true, dispute, nextStatus });
    setResolution('');
    setRefundRequested(false);
  };

  const submitUpdate = async () => {
    if (!resolveModal.dispute || !resolveModal.nextStatus) return;
    if (['RESOLVED', 'CLOSED'].includes(resolveModal.nextStatus) && !resolution.trim()) {
      toast.error(t('disputes.toastResolutionRequired'));
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch(`/disputes/${resolveModal.dispute.id}`, {
        status: resolveModal.nextStatus,
        resolution: resolution.trim() || undefined,
        refundRequested: ['RESOLVED', 'CLOSED'].includes(resolveModal.nextStatus) ? refundRequested : undefined,
      });
      toast.success(t('disputes.toastDisputeMarkedAs', { status: t(`disputes.${STATUS_CFG[resolveModal.nextStatus].labelKey}`) }));
      setResolveModal({ open: false });
      if (selected?.id === resolveModal.dispute.id) setSelected(data.data);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('disputes.toastUpdateFail'));
    } finally {
      setSaving(false);
    }
  };

  const openRaise = async () => {
    setRaiseOpen(true);
    setRaiseOrderId('');
    setRaiseDescription('');
    setRaiseClaim('');
    setRaiseBillLookup('');
    setRaiseLookupHit(null);
    try {
      const { data } = await api.get(`/outlets/${outletId}/orders`, { params: { limit: 50 } });
      setRaiseOrders(data.data?.orders || []);
    } catch {
      setRaiseOrders([]);
    }
  };

  const lookupBill = async () => {
    const trimmed = raiseBillLookup.trim();
    if (!trimmed) return;
    if (!outletId) { toast.error(t('disputes.toastPickOutletFirst')); return; }
    setRaiseLookupBusy(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/orders/by-number/${encodeURIComponent(trimmed)}`);
      const order = data.data ?? data;
      setRaiseLookupHit(order);
      setRaiseOrderId(order.id);
      toast.success(t('disputes.toastFoundOrder', { number: order.orderNumber }));
    } catch (e: any) {
      setRaiseLookupHit(null);
      setRaiseOrderId('');
      toast.error(e?.response?.data?.message || t('disputes.toastNoOrderForBill'));
    } finally {
      setRaiseLookupBusy(false);
    }
  };

  const submitRaise = async () => {
    if (!raiseOrderId) { toast.error(t('disputes.toastPickOrder')); return; }
    if (!raiseDescription.trim()) { toast.error(t('disputes.toastAddDescription')); return; }
    setRaising(true);
    try {
      await api.post('/disputes', {
        orderId: raiseOrderId,
        description: raiseDescription.trim(),
        claimAmount: raiseClaim ? Number(raiseClaim) : undefined,
      });
      toast.success(t('disputes.toastDisputeRaised'));
      setRaiseOpen(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('disputes.toastRaiseFail'));
    } finally {
      setRaising(false);
    }
  };

  const elapsedDays = (createdAt: string) => {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
    return days === 0 ? t('disputes.todayLabel') : t('disputes.daysAgo', { days });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t('disputes.title')}</h1>
          <p className="page-subtitle">{t('disputes.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={openRaise} disabled={tier === 'business' && !outletId}>
          <Plus size={15} /> {t('disputes.raiseBtn')}
        </button>
      </div>

      {outletPicker}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: t('disputes.statOpen'),      value: stats.open,      cls: 'border-red-200 bg-red-50',    text: 'text-red-700' },
            { label: t('disputes.statReviewing'), value: stats.reviewing, cls: 'border-yellow-200 bg-yellow-50', text: 'text-yellow-700' },
            { label: t('disputes.statResolved'),  value: stats.resolved,  cls: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700' },
            { label: t('disputes.statClosed'),    value: stats.closed,    cls: 'border-slate-200 bg-slate-50', text: 'text-slate-600' },
            { label: t('disputes.statPendingClaim'), value: `₹${Number(stats.pendingClaimAmount).toLocaleString('en-IN')}`, cls: 'border-purple-200 bg-purple-50', text: 'text-purple-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.cls}`}>
              <p className={`text-2xl font-black ${s.text}`}>{s.value}</p>
              <p className={`text-xs font-semibold mt-0.5 ${s.text} opacity-70`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + sort toolbar */}
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('disputes.searchPlaceholder')}
        sortBy={sortBy}
        onSortByChange={(v) => setSortBy(v as typeof sortBy)}
        sortDir={sortDir}
        onSortDirChange={setSortDir}
        sortOptions={[
          { value: 'createdAt',   label: t('disputes.sortNewest') },
          { value: 'claimAmount', label: t('disputes.sortClaim') },
          { value: 'status',      label: t('disputes.sortStatus') },
          { value: 'orderNumber', label: t('disputes.sortOrderNumber') },
        ]}
      />

      {/* Filter tabs */}
      <div className="card p-4 flex gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              filter === f ? 'bg-brand-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {f === 'ALL' ? t('disputes.filterAll') : t(`disputes.${STATUS_CFG[f as DisputeStatus].labelKey}`)}
            {f !== 'ALL' && stats && (
              <span className={clsx('ml-1.5 inline-flex w-4 h-4 items-center justify-center rounded-full text-[10px] font-bold',
                filter === f ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600')}>
                {stats[f.toLowerCase() as keyof Stats] as number || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Two-column layout: list + detail */}
      <div className="flex gap-4 items-start">
        {/* Dispute list */}
        <div className={clsx('space-y-3 min-w-0', selected ? 'flex-1' : 'w-full')}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)
          ) : visibleDisputes.length === 0 ? (
            <div className="card flex flex-col items-center py-20 text-center">
              <AlertTriangle size={36} className="text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium">
                {search
                  ? t('disputes.emptyMatchTitle', { query: search })
                  : filter !== 'ALL'
                    ? t('disputes.emptyStatusTitle', { status: t(`disputes.${STATUS_CFG[filter as DisputeStatus].labelKey}`) })
                    : t('disputes.emptyBasic')}
              </p>
            </div>
          ) : (
            visibleDisputes.map(dispute => {
              const cfg = STATUS_CFG[dispute.status];
              const isSelected = selected?.id === dispute.id;
              return (
                <div
                  key={dispute.id}
                  onClick={() => setSelected(isSelected ? null : dispute)}
                  className={clsx(
                    'card cursor-pointer transition-all',
                    isSelected && 'ring-2 ring-brand-400/60',
                    dispute.status === 'OPEN' && 'border-red-200',
                  )}
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-2.5 h-2.5 rounded-full shrink-0 mt-0.5', cfg.dot,
                          dispute.status === 'OPEN' && 'blink-fast')} />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{dispute.order.orderNumber}</p>
                          {dispute.order.customer && (
                            <p className="text-xs text-slate-400">{dispute.order.customer.name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">{elapsedDays(dispute.createdAt)}</span>
                        <span className={cfg.badge}>{t(`disputes.${cfg.labelKey}`)}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">{dispute.description}</p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      {dispute.claimAmount ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                          <IndianRupee size={10} /> {t('disputes.claimAmountPill', { amount: Number(dispute.claimAmount).toFixed(0) })}
                        </span>
                      ) : <span />}
                      <ChevronRight size={15} className={clsx('text-slate-400 transition-transform', isSelected && 'rotate-90')} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-96 shrink-0 card overflow-hidden sticky top-4">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-start justify-between">
              <div>
                <p className="text-white font-bold">{selected.order.orderNumber}</p>
                <span className={clsx('badge mt-1', STATUS_CFG[selected.status].badge)}>
                  {t(`disputes.${STATUS_CFG[selected.status].labelKey}`)}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Customer */}
              {selected.order.customer && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-400 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {selected.order.customer.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{selected.order.customer.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone size={10} /> {selected.order.customer.phone}
                    </p>
                  </div>
                </div>
              )}

              {/* Dispute description */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('disputes.custComplaint')}</p>
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-sm text-red-900 leading-relaxed">{selected.description}</p>
                  {selected.claimAmount && (
                    <p className="text-xs font-bold text-red-700 mt-2">
                      {t('disputes.claimAmountLine', { amount: Number(selected.claimAmount).toFixed(2) })}
                    </p>
                  )}
                </div>
              </div>

              {/* Order items */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('disputes.orderItemsHeading')}</p>
                <div className="space-y-1.5">
                  {selected.order.items?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="w-5 h-5 bg-slate-100 rounded font-bold text-xs flex items-center justify-center shrink-0">
                        {item.quantity}
                      </span>
                      <span>{item.item.name}</span>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500 pt-1 font-bold">
                    {t('disputes.orderTotal', { amount: Number(selected.order.totalAmount).toFixed(0) })}
                  </p>
                </div>
              </div>

              {/* Resolution (if exists) */}
              {selected.resolution && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('disputes.resolutionHeading')}</p>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-sm text-emerald-800">{selected.resolution}</p>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="text-xs text-slate-400 space-y-0.5">
                <p>{t('disputes.raised', { when: new Date(selected.createdAt).toLocaleString('en-IN') })}</p>
              </div>

              {/* Actions */}
              {NEXT_STATUSES[selected.status].length > 0 && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('disputes.updateStatusHeading')}</p>
                  {NEXT_STATUSES[selected.status].map(nextStatus => {
                    const NextIcon = STATUS_CFG[nextStatus].icon;
                    return (
                      <button
                        key={nextStatus}
                        onClick={() => openResolve(selected, nextStatus)}
                        className={clsx(
                          'w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                          nextStatus === 'REVIEWING' && 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200',
                          nextStatus === 'RESOLVED'  && 'bg-emerald-500 text-white hover:bg-emerald-600',
                          nextStatus === 'CLOSED'    && 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                        )}
                      >
                        <NextIcon size={15} />
                        {t('disputes.markAs', { status: t(`disputes.${STATUS_CFG[nextStatus].labelKey}`) })}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resolve modal */}
      <Modal
        open={resolveModal.open}
        onClose={() => setResolveModal({ open: false })}
        title={t('disputes.modalMarkAsTitle', { status: resolveModal.nextStatus ? t(`disputes.${STATUS_CFG[resolveModal.nextStatus].labelKey}`) : '' })}
        subtitle={resolveModal.dispute?.order.orderNumber}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setResolveModal({ open: false })}>{t('disputes.cancel')}</button>
            <button
              onClick={submitUpdate}
              disabled={saving}
              className={clsx('btn',
                resolveModal.nextStatus === 'RESOLVED' ? 'btn-primary' : 'bg-slate-700 text-white hover:bg-slate-800 px-5 py-2.5 text-sm rounded-xl')}
            >
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {t('disputes.confirm')}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {resolveModal.dispute && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700">
              {resolveModal.dispute.description}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              {t('disputes.resolutionLabel')}
              {['RESOLVED', 'CLOSED'].includes(resolveModal.nextStatus || '') && (
                <span className="text-red-500 ml-0.5">*</span>
              )}
            </label>
            <textarea
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              rows={3}
              placeholder={
                resolveModal.nextStatus === 'REVIEWING'
                  ? t('disputes.resolutionPlaceholderNote')
                  : t('disputes.resolutionPlaceholderExplain')
              }
              className="input resize-none"
            />
          </div>

          {['RESOLVED', 'CLOSED'].includes(resolveModal.nextStatus || '') && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={refundRequested}
                  onChange={e => setRefundRequested(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-pink-500 rounded"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{t('disputes.issueRefundHeader')}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    <Trans
                      i18nKey="disputes.issueRefundHint"
                      components={{
                        forRefund:      <span className="font-semibold text-pink-700" />,
                        resolved:       <span className="font-semibold text-sky-700" />,
                        refundComplete: <span className="font-semibold" />,
                      }}
                    />
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>
      </Modal>

      {/* Raise dispute modal */}
      <Modal
        open={raiseOpen}
        onClose={() => !raising && setRaiseOpen(false)}
        title={t('disputes.modalRaiseTitle')}
        subtitle={t('disputes.modalRaiseSubtitle')}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRaiseOpen(false)} disabled={raising}>{t('disputes.cancel')}</button>
            <button className="btn-primary" onClick={submitRaise} disabled={raising || !raiseOrderId || !raiseDescription.trim()}>
              {raising && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {t('disputes.submit')}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
              <Receipt size={12} /> {t('disputes.billLabel')}
            </label>
            <div className="flex gap-2">
              <input
                value={raiseBillLookup}
                onChange={(e) => setRaiseBillLookup(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupBill(); } }}
                placeholder={t('disputes.billPlaceholder')}
                className="input flex-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={lookupBill}
                disabled={raiseLookupBusy || !raiseBillLookup.trim()}
                className="btn-secondary"
              >
                {raiseLookupBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {t('disputes.find')}
              </button>
            </div>
            {raiseLookupHit && (
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3 text-xs">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-emerald-800">{raiseLookupHit.orderNumber}</p>
                  <p className="text-emerald-700 mt-0.5">
                    ₹{Number(raiseLookupHit.totalAmount).toFixed(0)} ·{' '}
                    {raiseLookupHit.customer?.name || raiseLookupHit.customer?.phone || t('disputes.counterFallback')} ·{' '}
                    {t('disputes.billItemsSummary', { count: raiseLookupHit.items?.length || 0 })}
                  </p>
                  <p className="text-emerald-600 text-[10px] mt-0.5">
                    {t('disputes.billPlaced', { when: new Date(raiseLookupHit.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) })}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex-1 h-px bg-slate-200" />
            <span>{t('disputes.orPickRecent')}</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{t('disputes.orderLabel')}</label>
            <select
              value={raiseOrderId}
              onChange={(e) => { setRaiseOrderId(e.target.value); setRaiseLookupHit(null); }}
              className="input"
            >
              <option value="">{t('disputes.selectOrder')}</option>
              {raiseOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} · ₹{Number(o.totalAmount).toFixed(0)} · {o.customer?.name || o.customer?.phone || t('disputes.counterFallback')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              {t('disputes.descriptionLabel')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={raiseDescription}
              onChange={e => setRaiseDescription(e.target.value)}
              rows={3}
              placeholder={t('disputes.descriptionPlaceholder')}
              className="input resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{t('disputes.claimAmountLabel')}</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={raiseClaim}
              onChange={e => setRaiseClaim(e.target.value)}
              className="input"
              placeholder={t('disputes.claimPlaceholder')}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
