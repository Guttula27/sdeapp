import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  AlertTriangle, CheckCircle2, Clock, MessageSquare,
  IndianRupee, User, Phone, ChevronRight, X, Plus, Search, Loader2, Receipt,
} from 'lucide-react';
import { RootState } from '../../store';
import { useUserRole } from '../../hooks/useUserRole';
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
const STATUS_CFG: Record<DisputeStatus, { badge: string; label: string; icon: any; dot: string }> = {
  OPEN:      { badge: 'badge-red',    label: 'Open',         icon: AlertTriangle,  dot: 'bg-red-500' },
  REVIEWING: { badge: 'badge-yellow', label: 'Reviewing',    icon: Clock,          dot: 'bg-yellow-500' },
  RESOLVED:  { badge: 'badge-green',  label: 'Resolved',     icon: CheckCircle2,   dot: 'bg-emerald-500' },
  CLOSED:    { badge: 'badge-slate',  label: 'Closed',       icon: CheckCircle2,   dot: 'bg-slate-400' },
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
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Dispute | null>(null);
  const [resolveModal, setResolveModal] = useState<{ open: boolean; dispute?: Dispute; nextStatus?: DisputeStatus }>({ open: false });
  const [resolution, setResolution]     = useState('');
  const [saving, setSaving]             = useState(false);

  // Raise-dispute (staff-initiated)
  const [raiseOpen, setRaiseOpen]               = useState(false);
  const [raiseOrders, setRaiseOrders]           = useState<any[]>([]);
  const [raiseOrderId, setRaiseOrderId]         = useState('');
  const [raiseDescription, setRaiseDescription] = useState('');
  const [raiseClaim, setRaiseClaim]             = useState('');
  // Cashier flow: type the bill number off the printed receipt, hit the
  // resolve button, and the order auto-populates without scrolling the
  // dropdown. `raiseBillLookup` is the typed value; `raiseLookupBusy`
  // toggles the spinner; `raiseLookupHit` holds the resolved order.
  const [raiseBillLookup, setRaiseBillLookup]   = useState('');
  const [raiseLookupBusy, setRaiseLookupBusy]   = useState(false);
  const [raiseLookupHit, setRaiseLookupHit]     = useState<any>(null);
  const [raising, setRaising]                   = useState(false);

  /* ── fetch ──────────────────────────────────────────────── */
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

  /* ── business-tier outlet picker ─────────────────────────── */
  const outletPicker = tier === 'business' && (
    <div className="card p-3 flex items-center gap-2">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Outlet</span>
      <select
        value={selectedOutletId}
        onChange={(e) => setSelectedOutletId(e.target.value)}
        className="input py-1.5 text-sm"
        style={{ minWidth: 200 }}
      >
        {businessOutlets.length === 0 && <option value="">No outlets</option>}
        {businessOutlets.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );

  /* ── update dispute ─────────────────────────────────────── */
  const [refundRequested, setRefundRequested] = useState(false);

  const openResolve = (dispute: Dispute, nextStatus: DisputeStatus) => {
    setResolveModal({ open: true, dispute, nextStatus });
    setResolution('');
    setRefundRequested(false);
  };

  const submitUpdate = async () => {
    if (!resolveModal.dispute || !resolveModal.nextStatus) return;
    if (['RESOLVED', 'CLOSED'].includes(resolveModal.nextStatus) && !resolution.trim()) {
      toast.error('Please add a resolution note');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch(`/disputes/${resolveModal.dispute.id}`, {
        status: resolveModal.nextStatus,
        resolution: resolution.trim() || undefined,
        refundRequested: ['RESOLVED', 'CLOSED'].includes(resolveModal.nextStatus) ? refundRequested : undefined,
      });
      toast.success(`Dispute marked as ${resolveModal.nextStatus}`);
      setResolveModal({ open: false });
      if (selected?.id === resolveModal.dispute.id) setSelected(data.data);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  /* ── raise dispute ──────────────────────────────────────── */
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

  // Resolve a bill number into an order id. Strict — must be exact. Used
  // by the cashier flow where the customer hands over a printed receipt.
  const lookupBill = async () => {
    const trimmed = raiseBillLookup.trim();
    if (!trimmed) return;
    if (!outletId) { toast.error('Pick an outlet first'); return; }
    setRaiseLookupBusy(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/orders/by-number/${encodeURIComponent(trimmed)}`);
      const order = data.data ?? data;
      setRaiseLookupHit(order);
      setRaiseOrderId(order.id);
      toast.success(`Found ${order.orderNumber}`);
    } catch (e: any) {
      setRaiseLookupHit(null);
      setRaiseOrderId('');
      toast.error(e?.response?.data?.message || 'No order found for that bill number');
    } finally {
      setRaiseLookupBusy(false);
    }
  };

  const submitRaise = async () => {
    if (!raiseOrderId) { toast.error('Pick an order'); return; }
    if (!raiseDescription.trim()) { toast.error('Add a description'); return; }
    setRaising(true);
    try {
      await api.post('/disputes', {
        orderId: raiseOrderId,
        description: raiseDescription.trim(),
        claimAmount: raiseClaim ? Number(raiseClaim) : undefined,
      });
      toast.success('Dispute raised');
      setRaiseOpen(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to raise dispute');
    } finally {
      setRaising(false);
    }
  };

  const elapsedDays = (createdAt: string) => {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
    return days === 0 ? 'Today' : `${days}d ago`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Dispute Management</h1>
          <p className="page-subtitle">Review and resolve customer disputes</p>
        </div>
        <button className="btn-primary" onClick={openRaise} disabled={tier === 'business' && !outletId}>
          <Plus size={15} /> Raise dispute
        </button>
      </div>

      {outletPicker}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Open',      value: stats.open,      cls: 'border-red-200 bg-red-50',    text: 'text-red-700' },
            { label: 'Reviewing', value: stats.reviewing, cls: 'border-yellow-200 bg-yellow-50', text: 'text-yellow-700' },
            { label: 'Resolved',  value: stats.resolved,  cls: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700' },
            { label: 'Closed',    value: stats.closed,    cls: 'border-slate-200 bg-slate-50', text: 'text-slate-600' },
            { label: 'Pending Claim', value: `₹${Number(stats.pendingClaimAmount).toLocaleString('en-IN')}`, cls: 'border-purple-200 bg-purple-50', text: 'text-purple-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.cls}`}>
              <p className={`text-2xl font-black ${s.text}`}>{s.value}</p>
              <p className={`text-xs font-semibold mt-0.5 ${s.text} opacity-70`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

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
            {f === 'ALL' ? 'All' : STATUS_CFG[f as DisputeStatus].label}
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
          ) : disputes.length === 0 ? (
            <div className="card flex flex-col items-center py-20 text-center">
              <AlertTriangle size={36} className="text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium">No disputes {filter !== 'ALL' ? `with status "${filter}"` : ''}</p>
            </div>
          ) : (
            disputes.map(dispute => {
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
                        <span className={cfg.badge}>{cfg.label}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">{dispute.description}</p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      {dispute.claimAmount ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                          <IndianRupee size={10} /> Claim: ₹{Number(dispute.claimAmount).toFixed(0)}
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
                  {STATUS_CFG[selected.status].label}
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
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Customer Complaint</p>
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-sm text-red-900 leading-relaxed">{selected.description}</p>
                  {selected.claimAmount && (
                    <p className="text-xs font-bold text-red-700 mt-2">
                      Claim amount: ₹{Number(selected.claimAmount).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Order items */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Order Items</p>
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
                    Order total: ₹{Number(selected.order.totalAmount).toFixed(0)}
                  </p>
                </div>
              </div>

              {/* Resolution (if exists) */}
              {selected.resolution && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Resolution</p>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-sm text-emerald-800">{selected.resolution}</p>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="text-xs text-slate-400 space-y-0.5">
                <p>Raised: {new Date(selected.createdAt).toLocaleString('en-IN')}</p>
              </div>

              {/* Actions */}
              {NEXT_STATUSES[selected.status].length > 0 && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Update Status</p>
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
                        Mark as {STATUS_CFG[nextStatus].label}
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
        title={`Mark as ${resolveModal.nextStatus ? STATUS_CFG[resolveModal.nextStatus].label : ''}`}
        subtitle={resolveModal.dispute?.order.orderNumber}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setResolveModal({ open: false })}>Cancel</button>
            <button
              onClick={submitUpdate}
              disabled={saving}
              className={clsx('btn',
                resolveModal.nextStatus === 'RESOLVED' ? 'btn-primary' : 'bg-slate-700 text-white hover:bg-slate-800 px-5 py-2.5 text-sm rounded-xl')}
            >
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Confirm
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
              Resolution / Note
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
                  ? 'Optional: add an internal note…'
                  : 'Explain how the issue was resolved, refund issued, etc.'
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
                  <p className="text-sm font-semibold text-slate-800">Issue a refund</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Order moves to <span className="font-semibold text-pink-700">For Refund</span> instead of <span className="font-semibold text-sky-700">Resolved</span>. Mark as <span className="font-semibold">Refund Complete</span> on the order once paid out.
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
        title="Raise a dispute"
        subtitle="On behalf of a customer for an order at this outlet"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRaiseOpen(false)} disabled={raising}>Cancel</button>
            <button className="btn-primary" onClick={submitRaise} disabled={raising || !raiseOrderId || !raiseDescription.trim()}>
              {raising && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Submit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Bill ID lookup — primary path for the cashier flow. Type the
              bill number from the printed receipt, hit Enter or the resolve
              button, and the order is pre-filled below. */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
              <Receipt size={12} /> Bill / Order ID
            </label>
            <div className="flex gap-2">
              <input
                value={raiseBillLookup}
                onChange={(e) => setRaiseBillLookup(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupBill(); } }}
                placeholder="e.g. ORD-OL-XXXXXXXX-00042"
                className="input flex-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={lookupBill}
                disabled={raiseLookupBusy || !raiseBillLookup.trim()}
                className="btn-secondary"
              >
                {raiseLookupBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Find
              </button>
            </div>
            {raiseLookupHit && (
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3 text-xs">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-emerald-800">{raiseLookupHit.orderNumber}</p>
                  <p className="text-emerald-700 mt-0.5">
                    ₹{Number(raiseLookupHit.totalAmount).toFixed(0)} ·{' '}
                    {raiseLookupHit.customer?.name || raiseLookupHit.customer?.phone || 'Counter'} ·{' '}
                    {raiseLookupHit.items?.length || 0} item{(raiseLookupHit.items?.length || 0) !== 1 ? 's' : ''}
                  </p>
                  <p className="text-emerald-600 text-[10px] mt-0.5">
                    Placed {new Date(raiseLookupHit.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex-1 h-px bg-slate-200" />
            <span>or pick from recent</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Order</label>
            <select
              value={raiseOrderId}
              onChange={(e) => { setRaiseOrderId(e.target.value); setRaiseLookupHit(null); }}
              className="input"
            >
              <option value="">— Select an order —</option>
              {raiseOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} · ₹{Number(o.totalAmount).toFixed(0)} · {o.customer?.name || o.customer?.phone || 'Counter'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={raiseDescription}
              onChange={e => setRaiseDescription(e.target.value)}
              rows={3}
              placeholder="What went wrong? e.g. wrong item served, food cold, missing parcel item…"
              className="input resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Claim amount (₹) — optional</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={raiseClaim}
              onChange={e => setRaiseClaim(e.target.value)}
              className="input"
              placeholder="0.00"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
