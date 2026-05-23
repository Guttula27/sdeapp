import { useState } from 'react';
import { Utensils, Coffee, Building, Bike } from 'lucide-react';

const TABS = [
  {
    key: 'dinein',
    icon: Utensils,
    label: 'Dine-in',
    headline: 'Tables that order themselves.',
    body:
      'Replace paper menus with a QR per table. Waiters focus on hospitality, not running tickets. Switch between prepaid and postpaid billing per outlet — or run both side by side.',
    bullets: ['Table-level QR codes', 'Prepaid or postpaid', 'Course pacing & merge bills'],
    models: ['Dine-in prepaid', 'Dine-in postpaid', 'Hybrid'],
  },
  {
    key: 'qsr',
    icon: Coffee,
    label: 'QSR',
    headline: 'Lines that move twice as fast.',
    body:
      'Self-service kiosk or counter QR for parcel. Prepaid checkout, token printed to the kitchen, customer pings on ready. Add parcel charges per item where applicable.',
    bullets: ['Prepaid self-service', 'Token-based ready alerts', 'Per-counter analytics'],
    models: ['Self-service', 'Self-service with parcel'],
  },
  {
    key: 'foodcourt',
    icon: Building,
    label: 'Food court & facilities',
    headline: 'One venue, many vendors, one bill.',
    body:
      'Built for mall food courts, airport terminals, IT-park cafeterias and corporate campuses. Each stall manages its own menu and kitchen; customers order from multiple stalls in one cart, pay once, and settlements split automatically.',
    bullets: ['Vendor-level menus', 'Shared seating mapping', 'Auto settlement reports'],
    models: ['Hybrid', 'Self-service', 'Dine-in postpaid'],
  },
  {
    key: 'cloud',
    icon: Bike,
    label: 'Cloud kitchen',
    headline: 'Delivery-first ops.',
    body:
      'Run multiple virtual brands from one kitchen. Track prep SLA, manage dispatch, and watch your hourly demand curve. Aggregator integrations on the roadmap.',
    bullets: ['Multi-brand from one kitchen', 'Prep-time SLA dashboard', 'Hourly demand forecasting'],
    models: ['Self-service with parcel'],
  },
];

export default function Audience() {
  const [active, setActive] = useState(TABS[0].key);
  const tab = TABS.find((t) => t.key === active)!;

  return (
    <section id="audience" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">Who it's for</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Built for every kind of kitchen.
          </h2>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`filter-pill flex items-center gap-2 ${
                active === t.key ? 'filter-pill-active' : 'filter-pill-inactive'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-10 card p-8 md:p-12 max-w-4xl mx-auto animate-fade-in" key={tab.key}>
          <h3 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">{tab.headline}</h3>
          <p className="mt-3 text-slate-600 leading-relaxed">{tab.body}</p>

          <ul className="mt-6 grid sm:grid-cols-3 gap-3">
            {tab.bullets.map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Service models</span>
            {tab.models.map((m) => (
              <span key={m} className="badge badge-slate">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
