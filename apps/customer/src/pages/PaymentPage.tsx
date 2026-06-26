import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  ArrowLeft, CheckCircle2, XCircle, Store, Smartphone, CreditCard,
  Landmark, Wallet, ChevronRight, AlertCircle, Settings, FlaskConical,
} from 'lucide-react';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';

// ─── Testing flags ───────────────────────────────────────────
// TODO(payments): TEST_UPI_AMOUNT_RUPEES — until the real reconciliation flow
// is wired we always invoke the UPI app for ₹1, regardless of the order total.
// The bill UI still shows the real amount; only the upi:// deep link is mocked.
// Set this back to `null` (or delete the flag) to charge the actual total.
const TEST_UPI_AMOUNT_RUPEES = 1;
// Whether to surface the "Testing Bypass" option that skips the UPI app and
// marks the order paid immediately. Flip to false to hide once we're done.
const SHOW_TESTING_BYPASS = true;

type UpiApp = { id: string; name: string; scheme: string };

const UPI_APPS: UpiApp[] = [
  { id: 'GPAY',    name: 'Google Pay', scheme: 'tez://upi/pay' },
  { id: 'PHONEPE', name: 'PhonePe',    scheme: 'phonepe://pay' },
  { id: 'PAYTM',   name: 'Paytm',      scheme: 'paytmmp://pay' },
  { id: 'BHIM',    name: 'BHIM',       scheme: 'upi://pay' },
  { id: 'OTHER',   name: 'Other UPI',  scheme: 'upi://pay' },
];

type GatewayMode = 'UPI' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'NET_BANKING' | 'WALLET';
const GATEWAY_MODES: { key: GatewayMode; label: string; icon: any; apiMode: string }[] = [
  { key: 'UPI',         label: 'UPI',         icon: Smartphone, apiMode: 'UPI' },
  { key: 'DEBIT_CARD',  label: 'Debit Card',  icon: CreditCard, apiMode: 'CARD' },
  { key: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard, apiMode: 'CARD' },
  { key: 'NET_BANKING', label: 'Net Banking', icon: Landmark,   apiMode: 'NET_BANKING' },
  { key: 'WALLET',      label: 'Wallet',      icon: Wallet,     apiMode: 'WALLET' },
];

type Stage = 'PICK_METHOD' | 'UPI_DIRECT' | 'GATEWAY';

interface NavState {
  outletId: string;
  tableId?: string | null;
  // Prepaid path: cart + breakdown set, billOrderId unset.
  cart?: any[];
  isParcel?: boolean;
  subtotal?: number;
  taxAmount?: number;
  parcelPreview?: number;
  total: number;
  // Postpaid Bill Now path: billOrderId set, cart unset. We settle the
  // existing order (plus optional tip) instead of creating a new one.
  billOrderId?: string;
  // Split-share pay path: splitShareId set so the Payment row links
  // back to the share at server side; billOrderId set to the parent
  // order so the server can validate; total = the share amount.
  splitShareId?: string;
  outletName?: string;
}

type ActiveGateway = {
  providerKey: string;
  providerName: string;
  charges: Record<GatewayMode, number>;
} | null;

export default function PaymentPage() {
  const { user } = useCustomerAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as NavState | undefined;

  const [stage, setStage] = useState<Stage>('PICK_METHOD');
  const [outlet, setOutlet] = useState<any>(null);
  const [gateway, setGateway] = useState<ActiveGateway>(null);
  const [gatewayMode, setGatewayMode] = useState<GatewayMode>('UPI');
  const [launched, setLaunched] = useState(false);
  const [creating, setCreating] = useState(false);

  // Resolve the user's preferred UPI app from their profile. Fall back to GPAY
  // when none is set — the user can also change this from Settings.
  const defaultUpiApp = useMemo(
    () => UPI_APPS.find((a) => a.id === user?.preferredUpiApp) || UPI_APPS[0],
    [user?.preferredUpiApp],
  );

  useEffect(() => {
    if (!state?.outletId) { navigate(-1); return; }
    api.get(`/outlets/${state.outletId}`).then(({ data }) => setOutlet(data.data)).catch(() => {});
    api.get('/integrations/payment-gateway/active')
      .then(({ data }) => setGateway(data.data || null))
      .catch(() => setGateway(null));
  }, [state, navigate]);

  // Tip (postpaid Bill Now only). Percentage chips + custom amount field.
  const [tipPct, setTipPct] = useState<number | null>(null);
  const [tipCustom, setTipCustom] = useState<string>('');
  const isBillNow = !!state?.billOrderId;

  // ─── Promotions ─────────────────────────────────────────────
  // Coupon picker (one per bill) + reward redemption slider. Skipped on the
  // Bill Now path since the open postpaid order's bill is already finalised
  // server-side (separate flow would be needed to retro-apply promos there).
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [rewardBalance, setRewardBalance] = useState<number>(0);
  const [couponId, setCouponId] = useState<string>('');
  const [rewardPoints, setRewardPoints] = useState<number>(0);
  const [liveQuote, setLiveQuote] = useState<any | null>(null);
  // Customer-picked freebies, keyed by offerId. Each entry is the list
  // of pool item picks (duplicates allowed → quantity > 1). Picked at
  // checkout when an active offer's pool is anything other than ITEM.
  const [freebiePicks, setFreebiePicks] = useState<Record<string, Array<{ itemId: string; quantity: number }>>>({});
  const [pickerOffer, setPickerOffer] = useState<any | null>(null);

  useEffect(() => {
    if (isBillNow || !state?.outletId || !user?.id) return;
    api.get(`/outlets/${state.outletId}/coupons/available`, { params: { userId: user.id } })
      .then(({ data }) => setAvailableCoupons(data.data || data || []))
      .catch(() => {});
    api.get(`/rewards/me/${user.id}`)
      .then(({ data }) => setRewardBalance((data.data || data)?.balance || 0))
      .catch(() => {});
  }, [isBillNow, state?.outletId, user?.id]);

  // Re-quote whenever the customer changes the coupon or points. Debounced
  // implicitly by user interaction speed — re-firing every keystroke is OK
  // for a single small endpoint hit.
  useEffect(() => {
    if (isBillNow || !state?.outletId || !state?.cart?.length || !user?.id) return;
    const payload = {
      lines: (state.cart || []).map((c: any) => ({
        itemId: c.itemId,
        variantId: c.variantId,
        quantity: c.quantity,
      })),
      isParcel: !!state.isParcel,
      customerId: user.id,
      // tableId lets the quote apply table-type price overrides — without
      // it a dine-in section's discounted price wouldn't be reflected on
      // the payment screen, and Razorpay would charge the wrong amount.
      tableId: state.tableId || undefined,
      couponId: couponId || undefined,
      rewardPoints: rewardPoints || undefined,
    };
    let cancelled = false;
    api.post(`/outlets/${state.outletId}/cart/quote`, payload)
      .then(({ data }) => { if (!cancelled) setLiveQuote(data.data || data); })
      .catch(() => { /* keep stale quote; surface in UI separately if needed */ });
    return () => { cancelled = true; };
  }, [isBillNow, state?.outletId, JSON.stringify(state?.cart), state?.isParcel, user?.id, couponId, rewardPoints]);

  if (!state || (!isBillNow && !state.cart?.length)) {
    return <p className="p-6 text-sm text-slate-500">Nothing to pay for.</p>;
  }

  // ── Freebie helpers ────────────────────────────────────────────────
  // Only non-ITEM scopes ask the customer to pick something — ITEM
  // (legacy) offers grant a fixed freebie that's already pinned by id
  // and don't need a modal.
  const pickableOffers = ((liveQuote?.offerFreebies ?? []) as any[])
    .filter((f) => f.pool?.scope && f.pool.scope !== 'ITEM');
  const pickedCountFor = (offerId: string) =>
    (freebiePicks[offerId] ?? []).reduce((s, p) => s + p.quantity, 0);
  const offersAwaitingPicks = pickableOffers.filter(
    (f) => pickedCountFor(f.offerId) < (f.pickQuantity ?? 0),
  );
  // Flatten freebie picks into the order-create items[] shape. Each
  // entry carries freebieOfferId so the API can validate the pool +
  // force a 0 price + tag the order line with the offer name.
  const freebieItemsPayload = Object.entries(freebiePicks).flatMap(
    ([offerId, picks]) =>
      picks
        .filter((p) => p.quantity > 0)
        .map((p) => ({
          itemId: p.itemId,
          quantity: p.quantity,
          freebieOfferId: offerId,
        })),
  );

  const upiId = outlet?.upiId;
  const outletName = outlet?.name || state.outletName || 'Outlet';
  // Promotions can lower the total — prefer the server-quoted figure when
  // it's available, fall back to the cart's pre-promo total.
  const subTotal = liveQuote?.totalAmount ?? state.total;
  const tipAmount = (() => {
    const custom = Number(tipCustom);
    if (Number.isFinite(custom) && custom > 0) return custom;
    if (tipPct != null) return Math.round(subTotal * tipPct) / 100;
    return 0;
  })();
  const baseTotal = subTotal + tipAmount;

  // Split-share Phase B: when the outlet's splitFeesAbsorbedBy is
  // OUTLET (default), the outlet eats the Razorpay surcharge so the
  // diner pays exactly their share amount. CUSTOMER keeps the
  // existing direct-order behaviour where the surcharge is added.
  // Pure direct-order flows (no splitShareId) keep their current
  // customer-absorbed behaviour untouched.
  const isSplitShare = !!state?.splitShareId;
  const splitFeesAbsorbedByOutlet = isSplitShare && outlet?.splitFeesAbsorbedBy === 'OUTLET';
  const gatewayChargePct = splitFeesAbsorbedByOutlet ? 0 : (gateway?.charges?.[gatewayMode] ?? 0);
  const gatewayCharge = useMemo(
    () => Math.round((baseTotal * gatewayChargePct) / 100 * 100) / 100,
    [baseTotal, gatewayChargePct],
  );
  const gatewayFinal = useMemo(
    () => Math.round((baseTotal + gatewayCharge) * 100) / 100,
    [baseTotal, gatewayCharge],
  );

  // Build a UPI deep link. During testing we hard-code the amount to ₹1
  // regardless of bill total; flip TEST_UPI_AMOUNT_RUPEES to null to send
  // the real amount.
  const buildUpiLink = (app: UpiApp) => {
    if (!upiId) return null;
    const am = TEST_UPI_AMOUNT_RUPEES != null ? TEST_UPI_AMOUNT_RUPEES.toFixed(2) : baseTotal.toFixed(2);
    const params = new URLSearchParams({
      pa: upiId, pn: outletName, am, cu: 'INR',
      tn: `Order ${Date.now()}`,
    });
    return `${app.scheme}?${params.toString()}`;
  };

  const launchUpi = () => {
    const link = buildUpiLink(defaultUpiApp);
    if (!link) { toast.error('Outlet does not have a UPI ID configured'); return; }
    setLaunched(true);
    window.location.href = link;
  };

  /* ── Place order & navigate to receipt ── */
  const placeOrder = async (extra: { paymentMode: string; notes?: string }) => {
    setCreating(true);
    try {
      // Bill Now flow: settle an existing postpaid order. Initiate the
      // payment (Cash auto-confirms; other modes return PENDING which we
      // immediately confirm to mirror the staff path) and head to receipt.
      // The tip is rolled into payment.amount; the receipt will surface the
      // breakdown via order.totalAmount vs payment.amount.
      if (isBillNow && state.billOrderId) {
        const { data: pay } = await api.post('/payments/initiate', {
          orderId: state.billOrderId,
          mode: extra.paymentMode,
          amount: baseTotal,
          // When the customer paid a split-bill share, pass the
          // shareId through so the server's confirmPayment hook
          // settles the share + bumps the order counters + fires
          // SPLIT_ALL_PAID inside one transaction.
          splitShareId: state.splitShareId,
        });
        if (extra.paymentMode !== 'CASH' && pay?.data?.paymentId) {
          await api.post(`/payments/${pay.data.paymentId}/confirm`, { gatewayRef: '' });
        }
        // Land back on the bill detail for split shares (so the
        // diner sees their share marked Paid + the live progress);
        // direct Bill Now keeps its existing receipt redirect.
        if (state.splitShareId) {
          navigate(`/bills/${state.splitShareId}`, { replace: true });
        } else {
          navigate(`/receipt/${state.billOrderId}`, { replace: true });
        }
        return;
      }
      const { data } = await api.post(`/outlets/${state.outletId}/orders`, {
        tableId: state.tableId || undefined,
        isParcel: state.isParcel,
        notes: extra.notes,
        paymentMode: extra.paymentMode,
        couponId: couponId || undefined,
        rewardPoints: rewardPoints || undefined,
        items: [
          ...(state.cart || []).map((c: any) => ({
            itemId: c.itemId,
            variantId: c.variantId,
            quantity: c.quantity,
            toppings: c.toppings?.map((t: any) => ({ toppingId: t.toppingId, optionId: t.optionId })) || undefined,
            bundleSelections: c.bundleSelections,
          })),
          ...freebieItemsPayload,
        ],
      });
      try { sessionStorage.removeItem(`cart-${state.outletId}`); } catch {}
      navigate(`/receipt/${data.data.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  const finishUpi      = () => placeOrder({ paymentMode: 'UPI' });
  // Bypass (dev testing) — historically wrote a payment-meta string into
  // order.notes, which then leaked onto the kitchen card (notes is for
  // the chef's "no chilli please"-style instructions). Drop the note;
  // the bypass intent is already recorded in the Payment row itself.
  const finishBypass   = () => placeOrder({ paymentMode: 'UPI' });

  // Gateway flow opens Razorpay checkout. Unlike UPI/Bypass which mark the
  // Payment SUCCESS at order-creation time, this path leaves the Payment
  // PENDING until Razorpay's handler returns a verified signature.
  const finishGateway = async () => {
    if (typeof window === 'undefined' || !(window as any).Razorpay) {
      toast.error('Payment gateway not loaded — refresh and try again');
      return;
    }
    const modeInfo = GATEWAY_MODES.find(m => m.key === gatewayMode)!;
    setCreating(true);
    try {
      let orderId = state.billOrderId;
      // Cart path: create the order WITHOUT paymentMode so no SUCCESS payment
      // is auto-stamped. We attach payment via /payments/initiate next.
      if (!orderId) {
        const { data } = await api.post(`/outlets/${state.outletId}/orders`, {
          tableId: state.tableId || undefined,
          isParcel: state.isParcel,
          couponId: couponId || undefined,
          rewardPoints: rewardPoints || undefined,
          items: [
            ...(state.cart || []).map((c: any) => ({
              itemId: c.itemId,
              variantId: c.variantId,
              quantity: c.quantity,
              toppings: c.toppings?.map((t: any) => ({ toppingId: t.toppingId, optionId: t.optionId })) || undefined,
            })),
            ...freebieItemsPayload,
          ],
        });
        orderId = data.data.id;
        try { sessionStorage.removeItem(`cart-${state.outletId}`); } catch {}
      }

      const { data: init } = await api.post('/payments/initiate', {
        orderId,
        mode: modeInfo.apiMode,
        amount: gatewayFinal,
      });
      const paymentId = init?.data?.paymentId;
      if (!paymentId) throw new Error('Payment could not be initiated');

      const { data: rzp } = await api.post('/payments/razorpay/order', { paymentId });
      const { keyId, orderId: rzpOrderId, amount, currency, outletName: payeeName } = rzp.data || {};
      if (!keyId || !rzpOrderId) throw new Error('Gateway order could not be created');

      await new Promise<void>((resolve, reject) => {
        const rzpInstance = new (window as any).Razorpay({
          key: keyId,
          order_id: rzpOrderId,
          amount,
          currency,
          name: payeeName || outletName,
          description: `Order ${orderId}`,
          prefill: user ? { name: user.name, contact: user.phone, email: user.email || undefined } : undefined,
          notes: { paymentId, orderId },
          theme: { color: '#0B4245' },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          handler: async (response: any) => {
            try {
              await api.post('/payments/razorpay/verify', {
                paymentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        rzpInstance.on('payment.failed', (resp: any) => {
          reject(new Error(resp?.error?.description || 'Payment failed'));
        });
        rzpInstance.open();
      });

      navigate(`/receipt/${orderId}`, { replace: true });
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || `Paid via ${gateway?.providerName ?? 'Gateway'} failed`);
    } finally {
      setCreating(false);
    }
  };

  /* ── Shared header ── */
  const Header = ({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) => (
    <div className="bg-white sticky top-0 z-20 shadow-sm">
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={17} />
        </button>
        <div>
          <p className="font-bold text-slate-900 text-base leading-tight">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  /* ── Shared payee + total breakdown ── */
  const PayeeCard = ({ amount }: { amount: number }) => (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
        <Store size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{outletName}</p>
        <p className="text-[11px] text-slate-400 truncate">{upiId || 'UPI ID not set'}</p>
      </div>
      <div className="text-right">
        <p className="text-[11px] text-slate-400">Amount</p>
        <p className="text-base font-black text-slate-900">₹{amount.toFixed(2)}</p>
      </div>
    </div>
  );

  /* ── STAGE 1: pick method ── */
  // Tip selector — only shown when settling a postpaid bill. Percentage
  // chips (5/10/15) auto-compute against the bill; "Custom" overrides.
  const TipPicker = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">Add a tip</p>
        <p className="text-xs text-slate-400">Optional</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[null, 5, 10, 15].map((pct) => (
          <button
            key={pct ?? 'none'}
            onClick={() => { setTipPct(pct); setTipCustom(''); }}
            className={clsx(
              'py-2 rounded-xl text-xs font-bold border transition-colors',
              !tipCustom && tipPct === pct
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
            )}
          >
            {pct == null ? 'None' : `${pct}%`}
          </button>
        ))}
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Custom amount (₹)</label>
        <input
          type="number"
          min="0"
          step="1"
          value={tipCustom}
          onChange={(e) => { setTipCustom(e.target.value); setTipPct(null); }}
          placeholder="e.g. 50"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
        />
      </div>
      <div className="border-t border-slate-100 pt-2.5 space-y-1 text-xs">
        <div className="flex justify-between text-slate-500"><span>Bill</span><span>₹{subTotal.toFixed(2)}</span></div>
        {tipAmount > 0 && (
          <div className="flex justify-between text-slate-500"><span>Tip</span><span>₹{tipAmount.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between font-black text-slate-900 text-sm pt-1 border-t border-slate-100">
          <span>You pay</span><span>₹{baseTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  if (stage === 'PICK_METHOD') {
    return (
      <div className="min-h-dvh bg-slate-50 flex flex-col">
        <Header title="Choose payment method" subtitle="Pick how you want to pay" onBack={() => navigate(-1)} />
        <div className="flex-1 px-4 py-4 space-y-4">
          <PayeeCard amount={baseTotal} />
          {isBillNow && <TipPicker />}

          {/* ── Freebie offer banners ──────────────────────────────────
              One card per eligible non-ITEM offer. The customer can't
              proceed to pay until every required freebie has been
              picked — the Pay buttons below are disabled while
              offersAwaitingPicks is non-empty. */}
          {!isBillNow && pickableOffers.map((f: any) => {
            const picked = pickedCountFor(f.offerId);
            const need = f.pickQuantity ?? 0;
            const done = picked >= need;
            const summary = (() => {
              const s = f.pool?.scope;
              if (s === 'ALL') return 'any item on the menu';
              if (s === 'CATEGORY') return `from ${f.pool?.categoryName || 'category'}`;
              if (s === 'ITEMS') return `from ${f.pool?.items?.length ?? 0} options`;
              return 'free item';
            })();
            return (
              <div
                key={f.offerId}
                className={`rounded-2xl border p-4 space-y-2 ${
                  done ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-bold ${done ? 'text-emerald-800' : 'text-amber-800'}`}>
                      🎁 {f.offerName}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Pick {need} {summary}{done && ' — ready'}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    done ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                  }`}>
                    {picked}/{need}
                  </span>
                </div>
                <button
                  onClick={() => setPickerOffer(f)}
                  className={`w-full py-2 rounded-xl text-sm font-bold transition-colors ${
                    done
                      ? 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {done ? 'Change picks' : `Pick your gift${need > 1 ? 's' : ''}`}
                </button>
              </div>
            );
          })}

          {/* Promotions — coupon + reward redemption. Hidden on Bill Now. */}
          {!isBillNow && (availableCoupons.length > 0 || rewardBalance > 0 || liveQuote) && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Apply promotions</p>

              {availableCoupons.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Coupon</label>
                  <select
                    value={couponId}
                    onChange={(e) => setCouponId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="">No coupon</option>
                    {availableCoupons.map((c: any) => {
                      const value = c.discountType === 'PERCENT' ? `${c.discountValue}% off` : `₹${c.discountValue} off`;
                      const suffix = c.kind === 'ALLOWANCE'
                        ? ` (allowance · ${c.perPeriodQuota}/${(c.resetPeriod || '').toLowerCase()})`
                        : '';
                      return (
                        <option key={c.id} value={c.id}>
                          {c.code} — {value}{suffix}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {rewardBalance > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Redeem points (balance: {rewardBalance})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={rewardBalance}
                    value={rewardPoints || ''}
                    placeholder="0"
                    onChange={(e) => setRewardPoints(Math.max(0, Math.min(rewardBalance, Number(e.target.value) || 0)))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              )}

              {liveQuote && (
                <div className="border-t border-slate-100 pt-2.5 space-y-1 text-xs">
                  {liveQuote.totalAutoDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Auto discounts</span><span>− ₹{liveQuote.totalAutoDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {liveQuote.coupon && (
                    <>
                      <div className="flex justify-between text-emerald-700">
                        <span>Coupon {liveQuote.coupon.code}</span><span>− ₹{liveQuote.coupon.amount.toFixed(2)}</span>
                      </div>
                      {/* ALLOWANCE coupons carry itemUnits — surface how many
                          quota units this redemption consumed so the
                          employee can see "2 of 5 / week" without opening
                          a separate ledger view. */}
                      {liveQuote.coupon.itemUnits != null && liveQuote.coupon.itemUnits > 0 && (
                        <div className="flex justify-end text-[10px] text-slate-500">
                          uses {liveQuote.coupon.itemUnits} item{liveQuote.coupon.itemUnits === 1 ? '' : 's'} from your allowance
                        </div>
                      )}
                    </>
                  )}
                  {liveQuote.reward && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Points redeemed ({liveQuote.reward.points})</span>
                      <span>− ₹{liveQuote.reward.amount.toFixed(2)}</span>
                    </div>
                  )}
                  {(liveQuote.offerFreebies || []).length > 0 && (
                    <div className="text-brand-900">
                      <span className="font-semibold">🎁 Complimentary: </span>
                      {liveQuote.offerFreebies.map((f: any) => `${f.quantity}× ${f.getItemName}`).join(', ')}
                    </div>
                  )}
                  <div className="flex justify-between font-black text-slate-900 text-sm pt-1 border-t border-slate-100">
                    <span>You pay</span><span>₹{liveQuote.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* UPI — uses the user's preferred app from their profile */}
          <div className="space-y-1">
            <button
              onClick={() => setStage('UPI_DIRECT')}
              className="w-full bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 text-left hover:border-brand-200 hover:shadow-sm transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Smartphone size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">Pay with {defaultUpiApp.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">Your default UPI app · direct UPI</p>
                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                  No extra charge
                </span>
              </div>
              <ChevronRight size={16} className="text-slate-400 shrink-0" />
            </button>
            {/* Change-default link → /profile. We don't gate this — even if the
                user hasn't set a default, they can pick one for next time. */}
            <button
              onClick={() => navigate('/profile')}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700 py-1.5"
            >
              <Settings size={11} /> Use a different UPI app
            </button>
          </div>

          {/* Gateway — visible only when the outlet has a Razorpay
              Linked Account configured AND the platform gateway is
              active. Either missing → hide the option entirely (per
              spec: "if route id is not available to outlet do not show
              razorpay option"). */}
          {gateway && outlet?.razorpayLinkedAccountId && (
          <button
            onClick={() => setStage('GATEWAY')}
            className="w-full rounded-2xl border p-4 flex items-center gap-3 text-left transition-all bg-white border-slate-100 hover:border-brand-200 hover:shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <CreditCard size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900">Pay via Payment Gateway</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {gateway ? `${gateway.providerName} · Cards, Net banking, Wallets, UPI` : 'No gateway configured'}
              </p>
              {gateway && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <AlertCircle size={10} /> Payment gateway charges will be extra
                </span>
              )}
            </div>
            <ChevronRight size={16} className="text-slate-400 shrink-0" />
          </button>
          )}

          {/* TODO(payments): TESTING BYPASS — remove this entire button once
              the real UPI reconciliation flow lands. SHOW_TESTING_BYPASS at the
              top of this file is the single switch. */}
          {SHOW_TESTING_BYPASS && (
            <button
              onClick={finishBypass}
              disabled={creating || offersAwaitingPicks.length > 0}
              className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-4 flex items-center gap-3 text-left hover:bg-amber-50 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <FlaskConical size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-amber-900">Testing Bypass</p>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  Mark order as paid without launching UPI. Dev only — removed before launch.
                </p>
              </div>
              {creating
                ? <span className="w-4 h-4 border-2 border-amber-700/30 border-t-amber-700 rounded-full animate-spin shrink-0" />
                : <ChevronRight size={16} className="text-amber-700 shrink-0" />}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── STAGE 2A: UPI direct — launches user's default app for ₹1 test ── */
  if (stage === 'UPI_DIRECT') {
    return (
      <div className="min-h-dvh bg-slate-50 flex flex-col">
        <Header
          title={`Pay with ${defaultUpiApp.name}`}
          subtitle="Direct UPI payment"
          onBack={() => { setStage('PICK_METHOD'); setLaunched(false); }}
        />
        <div className="flex-1 px-4 py-4 space-y-4">
          <PayeeCard amount={baseTotal} />

          {/* Breakdown — shows the REAL total, not the ₹1 test amount.
              Hidden on Bill Now (no cart breakdown to show; the TipPicker
              already renders the bill + tip + total). */}
          {!isBillNow && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-1">
              <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>₹{(state.subtotal ?? 0).toFixed(2)}</span></div>
              {(state.taxAmount ?? 0) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-slate-500"><span>SGST</span><span>₹{((state.taxAmount ?? 0) / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm text-slate-500"><span>CGST</span><span>₹{((state.taxAmount ?? 0) / 2).toFixed(2)}</span></div>
                </>
              )}
              {state.isParcel && (
                <div className="flex justify-between text-sm text-slate-500"><span>Parcel</span><span>₹{(state.parcelPreview ?? 0).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-100"><span>Total</span><span>₹{baseTotal.toFixed(2)}</span></div>
            </div>
          )}
          {isBillNow && <TipPicker />}

          {/* Default UPI app card + change link */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Your UPI app</p>
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-brand-300 ring-1 ring-brand-200 bg-brand-50/40">
              <Smartphone size={16} className="text-brand-500" />
              <span className="text-sm font-semibold text-slate-800 flex-1">{defaultUpiApp.name}</span>
              <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded-full">Default</span>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700 pt-2"
            >
              <Settings size={11} /> Change in Settings
            </button>
          </div>

          {/* Test-mode disclosure — visible so the customer/dev knows why
              the UPI app shows ₹1 instead of the bill total. */}
          {TEST_UPI_AMOUNT_RUPEES != null && (
            <p className="text-[11px] text-amber-700 text-center bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              Test mode — UPI app will be invoked for ₹{TEST_UPI_AMOUNT_RUPEES.toFixed(2)} only.
              The bill total is the actual ₹{baseTotal.toFixed(2)}.
            </p>
          )}

          {!launched ? (
            <button
              onClick={launchUpi}
              disabled={creating || offersAwaitingPicks.length > 0}
              className="w-full bg-gold-500 hover:bg-gold-600 text-charcoal-900 py-4 rounded-2xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Pay ₹{(TEST_UPI_AMOUNT_RUPEES ?? baseTotal).toFixed(2)} via {defaultUpiApp.name}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 text-center bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
                We've launched {defaultUpiApp.name}. Complete the payment and tap one of the buttons below.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { toast.error('Payment cancelled — try again'); setLaunched(false); }}
                  disabled={creating || offersAwaitingPicks.length > 0}
                  className="flex-1 bg-white border border-red-200 text-red-600 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                  <XCircle size={16} /> Payment failed
                </button>
                <button
                  onClick={finishUpi}
                  disabled={creating || offersAwaitingPicks.length > 0}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {creating
                    ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <CheckCircle2 size={16} />} I've paid
                </button>
              </div>
              <button onClick={launchUpi} className="w-full text-xs text-brand-600 hover:underline">
                Re-launch {defaultUpiApp.name}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── STAGE 2B: Gateway sub-mode picker (unchanged) ── */
  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      <Header
        title={gateway ? `Pay via ${gateway.providerName}` : 'Payment Gateway'}
        subtitle="Cards, Net banking, Wallets, UPI"
        onBack={() => setStage('PICK_METHOD')}
      />
      <div className="flex-1 px-4 py-4 space-y-4">
        <PayeeCard amount={gatewayFinal} />

        {/* Mode picker */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Choose payment mode</p>
          {GATEWAY_MODES.map(m => {
            const checked = gatewayMode === m.key;
            const pct = gateway?.charges?.[m.key] ?? 0;
            const Icon = m.icon;
            return (
              <label key={m.key} className={clsx(
                'flex items-center justify-between gap-3 px-3 py-3 rounded-xl border cursor-pointer',
                checked ? 'border-brand-300 ring-1 ring-brand-200 bg-brand-50/40' : 'border-slate-100',
              )}>
                <span className="flex items-center gap-3">
                  <input type="radio" name="gw-mode" checked={checked} onChange={() => setGatewayMode(m.key)} className="accent-brand-500" />
                  <Icon size={16} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">{m.label}</span>
                </span>
                <span className="text-[11px] font-bold text-amber-700">
                  {pct > 0 ? `+${pct}% fee` : 'no fee'}
                </span>
              </label>
            );
          })}
        </div>

        {/* Breakdown including gateway fee. On Bill Now we only show the
            running bill + tip total since there's no cart breakdown. */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-1">
          {isBillNow ? (
            <>
              <div className="flex justify-between text-sm text-slate-500"><span>Bill</span><span>₹{subTotal.toFixed(2)}</span></div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-sm text-slate-500"><span>Tip</span><span>₹{tipAmount.toFixed(2)}</span></div>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>₹{(state.subtotal ?? 0).toFixed(2)}</span></div>
              {(state.taxAmount ?? 0) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-slate-500"><span>SGST</span><span>₹{((state.taxAmount ?? 0) / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm text-slate-500"><span>CGST</span><span>₹{((state.taxAmount ?? 0) / 2).toFixed(2)}</span></div>
                </>
              )}
              {state.isParcel && (
                <div className="flex justify-between text-sm text-slate-500"><span>Parcel</span><span>₹{(state.parcelPreview ?? 0).toFixed(2)}</span></div>
              )}
            </>
          )}
          <div className="flex justify-between text-sm text-slate-700"><span>Order total</span><span>₹{baseTotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm text-amber-700">
            <span>Gateway charge ({gatewayChargePct}%)</span>
            <span>+ ₹{gatewayCharge.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-100"><span>You pay</span><span>₹{gatewayFinal.toFixed(2)}</span></div>
        </div>

        <button
          onClick={finishGateway}
          disabled={creating || offersAwaitingPicks.length > 0}
          className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {creating && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          Pay ₹{gatewayFinal.toFixed(2)} via {GATEWAY_MODES.find(m => m.key === gatewayMode)?.label}
        </button>
        <p className="text-[11px] text-slate-400 text-center">
          Secure payment processed by {gateway?.providerName ?? 'gateway'}.
        </p>
      </div>

      {/* ── Freebie picker modal ──────────────────────────────────────
          Opens when the customer taps a banner above. Each pool item
          gets a +/- counter so they can pick duplicates (e.g. 2× same
          dessert) up to the offer's pickQuantity cap. */}
      {pickerOffer && (
        <FreebiePickerModal
          offer={pickerOffer}
          picks={freebiePicks[pickerOffer.offerId] ?? []}
          onClose={() => setPickerOffer(null)}
          onSave={(picks) => {
            setFreebiePicks((p) => ({ ...p, [pickerOffer.offerId]: picks }));
            setPickerOffer(null);
          }}
        />
      )}
    </div>
  );
}

/* ── Freebie pool picker ───────────────────────────────────────────── */
function FreebiePickerModal({
  offer, picks, onClose, onSave,
}: {
  offer: any;
  picks: Array<{ itemId: string; quantity: number }>;
  onClose: () => void;
  onSave: (picks: Array<{ itemId: string; quantity: number }>) => void;
}) {
  const cap = offer.pickQuantity ?? 1;
  const items: Array<{ id: string; name: string; basePrice: number }> = offer.pool?.items ?? [];
  // Build a quantity map for editing — keep entries the customer
  // already picked, default everything else to 0.
  const initial = (() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.id] = 0;
    for (const p of picks) m[p.itemId] = (m[p.itemId] ?? 0) + p.quantity;
    return m;
  })();
  const [qty, setQty] = useState<Record<string, number>>(initial);
  const total = Object.values(qty).reduce((s, n) => s + n, 0);

  const bump = (id: string, delta: number) => {
    setQty((p) => {
      const next = Math.max(0, (p[id] ?? 0) + delta);
      // Block when adding would exceed the cap.
      if (delta > 0 && total >= cap) return p;
      return { ...p, [id]: next };
    });
  };

  const save = () => {
    const out: Array<{ itemId: string; quantity: number }> = [];
    for (const [itemId, q] of Object.entries(qty)) {
      if (q > 0) out.push({ itemId, quantity: q });
    }
    onSave(out);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl shadow-sheet max-h-[80dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-900">{offer.offerName}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Pick {cap} free item{cap === 1 ? '' : 's'}
              {' '}— {total}/{cap} selected
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 px-2">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-8">
              No eligible items right now.
            </p>
          ) : items.map((it) => {
            const q = qty[it.id] ?? 0;
            const canIncrement = total < cap;
            return (
              <div key={it.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{it.name}</p>
                  <p className="text-[11px] text-slate-400">
                    Normally ₹{Number(it.basePrice).toFixed(0)} · free in this offer
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => bump(it.id, -1)}
                    disabled={q === 0}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{q}</span>
                  <button
                    onClick={() => bump(it.id, +1)}
                    disabled={!canIncrement}
                    className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 safe-bottom space-y-2">
          <button
            onClick={save}
            disabled={total !== cap}
            className="w-full bg-gradient-to-r from-brand-500 to-brand-400 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg disabled:opacity-50"
          >
            {total === cap
              ? `Confirm ${cap} free item${cap === 1 ? '' : 's'}`
              : `Pick ${cap - total} more`}
          </button>
        </div>
      </div>
    </div>
  );
}
