import {
  QrCode, ChefHat, Building2, Boxes,
  CreditCard, BarChart3, ShieldCheck, MessageSquare,
  Landmark, Network, Users, Receipt,
} from 'lucide-react';

interface Feature {
  icon: any;
  tone: string;
  title: string;
  body: string;
  badge?: string;
}

const FEATURES: Feature[] = [
  {
    icon: QrCode,
    tone: 'icon-gradient-orange',
    title: 'QR ordering',
    body: 'Diners scan a table or outlet QR and order without downloading an app. Guest checkout supported.',
  },
  {
    icon: ChefHat,
    tone: 'icon-gradient-red',
    title: 'Live kitchen display',
    body: 'Orders stream into the KDS over WebSocket. One tap to move NEW → ACCEPTED → PREPARING → READY.',
  },
  {
    icon: Building2,
    tone: 'icon-gradient-indigo',
    title: 'Multi-outlet',
    body: 'Manage dine-in, QSR, parcel and hybrid outlets across cities from a single dashboard.',
  },
  {
    icon: Landmark,
    tone: 'icon-gradient-purple',
    title: 'Facility management',
    body: 'Run mall food courts, airport terminals, IT-park cafeterias and corporate campuses with shared seating and multi-business support.',
  },
  {
    icon: Boxes,
    tone: 'icon-gradient-teal',
    title: 'Inventory & vendors',
    body: 'Stock auto-deducts on sale. Low-stock triggers a purchase order to your preferred vendor.',
  },
  {
    icon: CreditCard,
    tone: 'icon-gradient-blue',
    title: 'Payments',
    body: 'UPI, cards, wallets, net banking and cash. Razorpay reconciliation via webhook — no manual entries.',
  },
  {
    icon: Receipt,
    tone: 'icon-gradient-green',
    title: 'Tax & compliance',
    body: 'GST auto-applied on bills at your registered rate. Input tax tracking, due-date reminders, GST-ready invoices.',
  },
  {
    icon: Users,
    tone: 'icon-gradient-orange',
    title: 'Workforce',
    body: 'Staff onboarding, shift allocation, punch-in/out with geo-tagging, overtime tracking and section assignments.',
  },
  {
    icon: BarChart3,
    tone: 'icon-gradient-indigo',
    title: 'Reports & analytics',
    body: 'Revenue, top items, hourly demand curves and average kitchen prep time — out of the box.',
  },
  {
    icon: MessageSquare,
    tone: 'icon-gradient-teal',
    title: 'Customer notifications',
    body: 'SMS, WhatsApp and email on order accept, ready and delivered. Reduce "is my food coming?" chaos.',
  },
  {
    icon: Network,
    tone: 'icon-gradient-slate',
    title: 'Aggregator integrations',
    body: 'Swiggy, Zomato and ONDC connectors with menu and status sync. One menu, every channel.',
    badge: 'On roadmap',
  },
  {
    icon: ShieldCheck,
    tone: 'icon-gradient-red',
    title: 'RBAC + audit',
    body: 'Granular role + responsibility matrix. Every sensitive action logged for compliance.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">Features</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Everything you need to run service. Nothing you don't.
          </h2>
          <p className="mt-3 text-slate-600">
            Built top-to-bottom for restaurants — not a generic POS retrofitted with food workflows.
          </p>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, tone, title, body, badge }) => (
            <div key={title} className="card card-hover p-6 relative">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>
                <Icon size={20} />
              </div>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                {badge && <span className="badge badge-slate text-[10px]">{badge}</span>}
              </div>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
