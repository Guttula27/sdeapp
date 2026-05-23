import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const QA = [
  {
    q: 'How long does it take to set up?',
    a: 'Most single-outlet restaurants are onboarded in days, not weeks. We import your menu from a spreadsheet, print table QR codes, and train your staff over a short call. Multi-outlet or food-court setups take a bit longer depending on scope.',
  },
  {
    q: 'Which payment gateways do you support?',
    a: 'UPI (any app), cards, wallets and net banking via Razorpay. Cash is supported natively with auto-confirmation. Additional gateways and split-payment flows can be added on Enterprise.',
  },
  {
    q: 'Do you support food courts with multiple vendors?',
    a: 'Yes. Our facility management layer lets a single physical venue — mall food court, airport terminal, IT-park cafeteria, corporate campus — host multiple businesses with shared seating. Customers can order from multiple stalls in one cart, and settlements split automatically.',
  },
  {
    q: 'Do you integrate with Swiggy, Zomato or ONDC?',
    a: 'Aggregator and ONDC integrations are on the roadmap with menu sync and status sync built in by design. Talk to us if this is a launch-blocker — we can prioritise based on demand.',
  },
  {
    q: 'Does it work without internet?',
    a: 'The kitchen display and order taking degrade gracefully on flaky connections. Brief outages queue locally and sync when the network returns. Payment authorisation requires connectivity.',
  },
  {
    q: 'Who owns the data?',
    a: 'You do. Your menu, customer list, orders and reports are yours. We provide exports on request and never sell or share data with third parties.',
  },
  {
    q: 'How is GST handled?',
    a: 'GST is auto-applied at the rate configured for your registration. Bills and subscription invoices are generated GST-compliant. Input tax tracking and due-date reminders are built in.',
  },
  {
    q: 'What kind of support do you offer?',
    a: 'Email support on Starter, priority chat + phone support on Growth, and a dedicated customer success manager with SLA on Enterprise.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-canvas">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">FAQ</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Frequently asked questions
          </h2>
        </div>

        <div className="mt-12 space-y-3">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="text-sm md:text-base font-bold text-slate-900 pr-4">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed animate-slide-down">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
