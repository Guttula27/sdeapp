import { Check, Sparkles } from 'lucide-react';

const PLANS = [
  {
    name: 'Starter',
    tagline: 'For single outlets just getting started.',
    features: [
      '1 outlet',
      'Up to 3 users',
      'QR ordering + KDS',
      'Cash + UPI payments',
      'Basic reports',
      'Email support',
    ],
    cta: 'Talk to sales',
    highlight: false,
  },
  {
    name: 'Growth',
    tagline: 'For multi-outlet operators that need analytics.',
    features: [
      'Up to 5 outlets',
      'Up to 15 users',
      'Everything in Starter',
      'Razorpay + cards + wallets',
      'Inventory & vendors',
      'Workforce & attendance',
      'Customer notifications',
      'Advanced analytics',
      'Priority support',
    ],
    cta: 'Talk to sales',
    highlight: true,
  },
  {
    name: 'Enterprise',
    tagline: 'Chains, food courts, facilities and cloud kitchens at scale.',
    features: [
      'Unlimited outlets & users',
      'Everything in Growth',
      'Multi-vendor food court / facility management',
      'Aggregator & ONDC integrations (roadmap)',
      'Custom integrations',
      'SLA + dedicated CSM',
      'On-prem option',
    ],
    cta: 'Talk to sales',
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-canvas">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">Plans</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Plans that scale with you.
          </h2>
          <p className="mt-3 text-slate-600">
            Pricing is tailored to your outlets, users and integrations.
            Tell us about your setup and we'll send a quote.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`card p-8 relative flex flex-col ${
                p.highlight ? 'ring-2 ring-brand-500 shadow-pop' : ''
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge badge-orange shadow-sm">
                  <Sparkles size={10} /> Most popular
                </span>
              )}

              <h3 className="text-lg font-black text-slate-900">{p.name}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{p.tagline}</p>

              <div className="mt-5 min-h-[68px] flex items-center">
                <div>
                  <span className="text-2xl font-black text-slate-900 tracking-tight">Custom pricing</span>
                  <p className="text-xs text-slate-500 mt-1">Based on outlets, users &amp; usage</p>
                </div>
              </div>

              <ul className="mt-6 space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-slate-700">
                    <Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#cta"
                className={`mt-7 ${p.highlight ? 'btn-primary' : 'btn-secondary'} btn-lg w-full`}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          All plans include a free trial. Razorpay transaction fees apply per their published pricing.
          GST applicable on subscription invoices.
        </p>
      </div>
    </section>
  );
}
