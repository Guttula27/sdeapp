import { Heart, History, Tag, Bell, MessageCircleQuestion, Star } from 'lucide-react';

const PERKS = [
  { icon: Heart,                title: 'Favourites & popular picks', body: 'Diners save go-to items and discover what others love at your outlet.' },
  { icon: History,              title: 'Order history & re-order',   body: 'Past orders are one tap away, with spend summaries and most-ordered items.' },
  { icon: Tag,                  title: 'Offers & coupons',            body: 'Percentage, flat, combo, happy-hour and coupon-code promotions, all configurable.' },
  { icon: Bell,                 title: 'Live order tracking',         body: 'Accepted → Preparing → Ready → Delivered, with SMS and WhatsApp pings on key events.' },
  { icon: Star,                 title: 'Reviews & loyalty tags',      body: 'Diners rate items; you tag VIPs and preferences for personalised service.' },
  { icon: MessageCircleQuestion, title: 'Dispute arbitration',        body: 'Customers raise post-delivery claims with attachments; you resolve them in-app.' },
];

export default function DinerExperience() {
  return (
    <section id="diner" className="py-24 bg-canvas">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">For your diners</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Built to delight diners too.
          </h2>
          <p className="mt-3 text-slate-600">
            A great kitchen isn't enough if the ordering experience is clunky. Your customers
            get a PWA that feels native — no install required.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PERKS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card card-hover p-6 flex gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center icon-gradient-orange shrink-0">
                <Icon size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
