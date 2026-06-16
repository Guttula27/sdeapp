import { Link } from 'react-router-dom';
import { Check, MessageSquare, Wallet, Sparkles } from 'lucide-react';

const INCLUDED = [
  'Unlimited outlets, unlimited users',
  'QR ordering, KDS, service & parcel desks',
  'Menu, modifiers, toppings, table types',
  'Razorpay UPI / cards / wallets / net-banking',
  'Live orders, kitchen routing, station prints',
  'Coupons, discounts, offers, rewards',
  'Reports, analytics, audit logs',
  'Offline-first apps with idempotent sync',
];

const MESSAGING = [
  { label: 'Order received',  detail: 'Confirmation SMS / WhatsApp the moment a customer pays' },
  { label: 'Ready for pickup', detail: 'Auto-fired when KDS marks the order ready' },
  { label: 'Payment receipt',  detail: 'Tax-compliant receipt to the customer' },
  { label: 'Feedback request', detail: 'Post-meal NPS / rating ping' },
  { label: 'Promotional blast', detail: 'Only to customers who have opted in' },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-canvas">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">Pricing</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Free to use. Pay only for what your customers receive.
          </h2>
          <p className="mt-3 text-slate-600">
            No platform fee. No per-seat fee. No per-outlet fee. You only pay for the messages we
            dispatch to your customers on your behalf — and you can pre-pay or post-pay.
          </p>
        </div>

        {/* Free platform — hero card */}
        <div className="mt-12 card p-8 md:p-10 relative overflow-hidden ring-2 ring-brand-500 shadow-pop">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge badge-orange shadow-sm">
            <Sparkles size={10} /> Always free for outlets
          </span>

          <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">The VEZEOR Platform</h3>
              <p className="mt-2 text-slate-600">
                Full access to QR ordering, kitchen display, service & parcel desks, menu, payments,
                promotions, reports and audit. Use it for one café or fifty outlets — the platform is
                <strong> free of charge</strong>.
              </p>

              <ul className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {INCLUDED.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-slate-700">
                    <Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-brand-50/60 rounded-2xl border border-brand-100 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-700">Platform fee</p>
              <div className="mt-2 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-black text-slate-900 tracking-tight">₹0</span>
                <span className="text-slate-500 text-sm">/ month</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">No licence, no seats, no onboarding fee.</p>
              <a href="#cta" className="mt-5 btn-primary btn-lg w-full">Book a demo</a>
            </div>
          </div>
        </div>

        {/* Pay-as-you-go: messaging + payments */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {/* Messaging */}
          <div className="card p-7 flex flex-col">
            <div className="flex items-center gap-3">
              <span className="icon-gradient-teal w-10 h-10 rounded-xl flex items-center justify-center">
                <MessageSquare size={18} />
              </span>
              <h3 className="text-lg font-black text-slate-900">Customer messaging</h3>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              The Platform sends order-lifecycle messages to your customers on your behalf — SMS,
              WhatsApp, email or push. You pay per message at the published rate card.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">Pre-paid pool</p>
                <p className="mt-1.5 text-sm text-slate-700">Buy a Message Pool upfront. Consumed message-by-message.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">Post-paid</p>
                <p className="mt-1.5 text-sm text-slate-700">Settled monthly against an invoice with credit terms.</p>
              </div>
            </div>

            <ul className="mt-5 space-y-2 flex-1">
              {MESSAGING.map((m) => (
                <li key={m.label} className="flex gap-2 text-sm">
                  <Check size={14} className="text-emerald-600 mt-1 shrink-0" />
                  <span className="text-slate-700"><strong className="text-slate-900">{m.label}</strong> — <span className="text-slate-500">{m.detail}</span></span>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-xs text-slate-500">
              Rate card per channel is visible inside the Outlet billing dashboard. See the{' '}
              <Link to="/legal/refund" className="text-brand-600 hover:text-brand-700 font-semibold">
                Refund Policy
              </Link>{' '}for Pool balance treatment.
            </p>
          </div>

          {/* Payments */}
          <div className="card p-7 flex flex-col">
            <div className="flex items-center gap-3">
              <span className="icon-gradient-indigo w-10 h-10 rounded-xl flex items-center justify-center">
                <Wallet size={18} />
              </span>
              <h3 className="text-lg font-black text-slate-900">Customer payments</h3>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Customers pay through Razorpay UPI / cards / wallets / net banking. Settlement reaches
              <strong> your bank account directly</strong>, on Razorpay's settlement schedule.
            </p>

            <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm">
              <p className="font-bold text-emerald-900">VEZEOR's cut from each customer payment</p>
              <p className="mt-1 text-3xl font-black text-emerald-700 tracking-tight">₹0</p>
              <p className="mt-1 text-xs text-emerald-800">
                We are not a payment aggregator. We don't hold or route your money.
              </p>
            </div>

            <ul className="mt-5 space-y-2 flex-1">
              <li className="flex gap-2 text-sm text-slate-700">
                <Check size={14} className="text-emerald-600 mt-1 shrink-0" />
                Razorpay's published gateway fees apply per their terms.
              </li>
              <li className="flex gap-2 text-sm text-slate-700">
                <Check size={14} className="text-emerald-600 mt-1 shrink-0" />
                Settlement direct to your nominated bank account.
              </li>
              <li className="flex gap-2 text-sm text-slate-700">
                <Check size={14} className="text-emerald-600 mt-1 shrink-0" />
                Failed-payment auto-reversal handled by the gateway.
              </li>
              <li className="flex gap-2 text-sm text-slate-700">
                <Check size={14} className="text-emerald-600 mt-1 shrink-0" />
                Refunds and disputes initiated from your service desk.
              </li>
            </ul>
          </div>
        </div>

        {/* Future paid features — honest disclosure */}
        <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200 p-6">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Roadmap</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">Future paid add-ons (opt-in)</h4>
          <p className="mt-2 text-sm text-slate-600">
            We may, in time, introduce paid extras — advanced analytics, premium support tiers, or a
            platform-wide customer rewards programme. Every paid add-on will be <strong>opt-in</strong> with
            its own terms shown to you at the point of opt-in. Until then, the core Platform stays free.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          All charges payable to VEZEOR are exclusive of GST. By using the Platform you agree to our{' '}
          <Link to="/legal/terms" className="font-semibold text-brand-600 hover:text-brand-700">Terms</Link>,{' '}
          <Link to="/legal/privacy" className="font-semibold text-brand-600 hover:text-brand-700">Privacy Policy</Link>{' '}and{' '}
          <Link to="/legal/refund" className="font-semibold text-brand-600 hover:text-brand-700">Refund Policy</Link>.
        </p>
      </div>
    </section>
  );
}
