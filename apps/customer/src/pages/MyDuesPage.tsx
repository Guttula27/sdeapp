import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wallet, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';

type DuesRow = {
  outletId: string;
  outletName: string | null;
  businessName: string | null;
  outletUpiId: string | null;
  currentBalance: number;
  tag: { name: string; color: string; maxDueAmount: number | null } | null;
};

/**
 * Customer-facing "My Dues" — one row per outlet where the customer
 * has any pay-later balance. Settle dialog offers two rails:
 *
 *   1) Razorpay checkout — server verifies the signature, then writes
 *      the settlement with paymentMode='RAZORPAY' + the Razorpay
 *      payment id as reference. Auditable end-to-end.
 *   2) UPI deeplink — opens the customer's UPI app. After return, the
 *      customer reports the txn id back; we write a settlement with
 *      paymentMode='UPI'. NOT server-verified — admins can void it
 *      later if bank reconciliation shows no payment landed.
 */
export default function MyDuesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();

  const [rows, setRows] = useState<DuesRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [active, setActive] = useState<DuesRow | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/dues/me');
      setRows(data?.data ?? data ?? []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('dues.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const total = rows.reduce((s, r) => s + r.currentBalance, 0);

  return (
    <div className="h-dvh flex flex-col bg-slate-50 overflow-hidden">
      <div className="bg-brand-700 sticky top-0 z-20 shadow-sm">
        <div className="px-3 py-3 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 text-white/90 hover:text-white -ml-1">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-base font-bold leading-tight truncate">{t('dues.title')}</p>
            <p className="text-brand-200 text-[11px]">
              {rows.length === 0
                ? t('dues.noBalance')
                : t('dues.totalSummary', { count: rows.length, amount: total.toFixed(2) })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="text-center text-sm text-slate-400 py-12">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <Wallet size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 font-medium">{t('dues.allSettled')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('dues.settledHint')}</p>
          </div>
        ) : (
          rows.map((r) => (
            <button
              key={r.outletId}
              onClick={() => setActive(r)}
              className="w-full text-left bg-white rounded-2xl border border-slate-100 p-4 shadow-card flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{r.outletName || t('dues.outletFallback')}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {r.businessName && (
                    <p className="text-xs text-slate-500 truncate">{r.businessName}</p>
                  )}
                  {r.tag && (
                    <span
                      className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
                      style={{ background: r.tag.color }}
                    >
                      {r.tag.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-500">{t('dues.outstanding')}</p>
                <p className="text-lg font-black text-rose-700">₹{r.currentBalance.toFixed(2)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {active && (
        <SettleDialog
          row={active}
          user={user}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            fetchRows();
          }}
        />
      )}
    </div>
  );
}

// ─── Settle dialog ────────────────────────────────────────────────

function SettleDialog({
  row, user, onClose, onDone,
}: {
  row: DuesRow;
  user: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(row.currentBalance.toFixed(2));
  const [busy, setBusy] = useState<null | 'razorpay' | 'upi'>(null);
  // After the customer reports the UPI deeplink intent, they need to
  // come back and confirm with the txn id. We hold the requested
  // amount on this state so the deeplink + confirm pair are coherent.
  const [upiConfirm, setUpiConfirm] = useState<null | { amount: number }>(null);
  const [upiTxnId, setUpiTxnId] = useState('');

  const parsed = Number(amount);
  const validAmount = Number.isFinite(parsed) && parsed > 0 && parsed - row.currentBalance <= 0.01;

  const payRazorpay = async () => {
    if (!validAmount) return;
    if (typeof window === 'undefined' || !(window as any).Razorpay) {
      toast.error(t('dues.gatewayNotLoaded'));
      return;
    }
    setBusy('razorpay');
    try {
      const { data: orderRes } = await api.post(
        `/outlets/${row.outletId}/dues/me/settle/razorpay-order`,
        { amount: parsed },
      );
      const { orderId, amount: rpAmount, currency, keyId } = orderRes?.data ?? orderRes;
      if (!keyId || !orderId) throw new Error('Gateway order could not be created');

      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: keyId,
          order_id: orderId,
          amount: rpAmount,
          currency,
          name: row.outletName || 'PayNPik',
          description: `Settle dues — ${row.outletName || ''}`,
          prefill: user ? { name: user.name, contact: user.phone, email: user.email || undefined } : undefined,
          notes: { kind: 'CUSTOMER_DUES_SETTLE', outletId: row.outletId, userId: user?.id },
          theme: { color: '#0B4245' },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          handler: async (resp: any) => {
            try {
              await api.post(
                `/outlets/${row.outletId}/dues/me/settle/razorpay-verify`,
                {
                  amount: parsed,
                  razorpayOrderId:   resp.razorpay_order_id,
                  razorpayPaymentId: resp.razorpay_payment_id,
                  razorpaySignature: resp.razorpay_signature,
                },
              );
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        rzp.on('payment.failed', (r: any) => reject(new Error(r?.error?.description || 'Payment failed')));
        rzp.open();
      });

      toast.success(t('dues.settled'));
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || t('dues.paymentFailed'));
    } finally {
      setBusy(null);
    }
  };

  // UPI deeplink: hand off to the customer's UPI app. We can't observe
  // the bank's confirmation, so on return the customer must enter
  // their txn id which we record (and the admin reconciles offline).
  const openUpiApp = () => {
    if (!validAmount) return;
    const vpa = row.outletUpiId;
    if (!vpa) {
      toast.error(t('dues.noUpiConfigured'));
      return;
    }
    const params = new URLSearchParams({
      pa: vpa,
      pn: row.outletName || 'PayNPik',
      am: parsed.toFixed(2),
      cu: 'INR',
      tn: `Dues settlement — ${row.outletName || ''}`.slice(0, 80),
    });
    window.location.href = `upi://pay?${params.toString()}`;
    // The browser hands off to the UPI app. When the customer returns
    // (often without us knowing), they see the confirm form.
    setUpiConfirm({ amount: parsed });
  };

  const confirmUpi = async () => {
    if (!upiConfirm) return;
    if (!upiTxnId.trim()) {
      toast.error(t('dues.enterUpiTxnId'));
      return;
    }
    setBusy('upi');
    try {
      await api.post(
        `/outlets/${row.outletId}/dues/me/settle/upi-reported`,
        { amount: upiConfirm.amount, upiTxnId: upiTxnId.trim() },
      );
      toast.success(t('dues.recordedHint'));
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('dues.recordFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-3"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold text-slate-900">{t('dues.payDues', { outletName: row.outletName ?? '' })}</h3>
          <p className="text-sm text-slate-600 mt-1">
            {t('dues.outstanding')}: <span className="font-bold text-rose-700">₹{row.currentBalance.toFixed(2)}</span>
          </p>
        </div>

        {!upiConfirm && (
          <>
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('dues.amountLabel')}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {!validAmount && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {t('dues.amountHelp', { max: row.currentBalance.toFixed(2) })}
                </p>
              )}
            </label>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                className="px-4 py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold disabled:opacity-50"
                disabled={!validAmount || !!busy}
                onClick={payRazorpay}
              >
                {busy === 'razorpay' ? t('dues.opening') : t('dues.payWithRazorpay')}
              </button>
              {row.outletUpiId ? (
                <button
                  className="px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-bold text-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  disabled={!validAmount || !!busy}
                  onClick={openUpiApp}
                >
                  {t('dues.openUpiApp')} <ExternalLink size={13} />
                </button>
              ) : (
                <p className="text-[11px] text-slate-400 text-center">{t('dues.upiUnavailable')}</p>
              )}
              <button
                className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700"
                onClick={onClose}
                disabled={!!busy}
              >
                {t('dues.cancel')}
              </button>
            </div>
          </>
        )}

        {upiConfirm && (
          <>
            <p className="text-sm text-slate-700">
              {t('dues.upiConfirmHint')}
            </p>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder={t('dues.upiTxnIdPlaceholder')}
              value={upiTxnId}
              onChange={(e) => setUpiTxnId(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                onClick={() => { setUpiConfirm(null); setUpiTxnId(''); }}
                disabled={!!busy}
              >
                {t('dues.cancel')}
              </button>
              <button
                className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold disabled:opacity-50"
                disabled={!!busy || !upiTxnId.trim()}
                onClick={confirmUpi}
              >
                {busy === 'upi' ? t('dues.saving') : t('dues.confirmSettlement')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
