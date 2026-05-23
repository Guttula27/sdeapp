import { QrCode, ChefHat, IndianRupee, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    icon: QrCode,
    tone: 'icon-gradient-orange',
    title: 'Diner scans the table QR',
    body: 'Menu opens in their browser. They customise variants & add-ons, place the order.',
  },
  {
    icon: ChefHat,
    tone: 'icon-gradient-red',
    title: 'Kitchen sees it live',
    body: 'Order appears on the KDS instantly. Staff advance status with one tap — diner sees updates without refreshing.',
  },
  {
    icon: IndianRupee,
    tone: 'icon-gradient-green',
    title: 'You get paid + analytics',
    body: 'UPI / card / cash, GST handled automatically. Reports flow into your daily dashboard.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-24 bg-canvas">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">How it works</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Three steps from scan to paid.
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6 relative">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="card p-7 h-full">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-slate-200 leading-none">0{i + 1}</span>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.tone}`}>
                    <s.icon size={20} />
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
              </div>

              {i < STEPS.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 w-6 h-6 items-center justify-center rounded-full bg-white border border-slate-200 shadow-xs">
                  <ArrowRight size={12} className="text-slate-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
