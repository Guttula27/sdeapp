import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const PROBLEMS = [
  'Split tools: one app for orders, another for kitchen, a third for accounts.',
  'Waiters running between tables and the POS during peak hours.',
  'No live visibility into what the kitchen is actually doing.',
  'Inventory and vendor payments tracked on WhatsApp and paper.',
];

const SOLUTIONS = [
  'One screen for orders, KDS, payments, inventory, vendors and reports.',
  'Customers scan a QR and place orders themselves — kitchen sees them instantly.',
  'Realtime kitchen display with prep timers and stage-by-stage tracking.',
  'Stock auto-deducts on sale; low-stock alerts trigger purchase orders.',
];

export default function ProblemSolution() {
  return (
    <section className="py-24 bg-canvas">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">The problem</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Restaurants are run on five disconnected tools.
          </h2>
          <p className="mt-3 text-slate-600">
            That worked when you had one outlet. It does not scale to five.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="card p-7">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center icon-gradient-red">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Without PayNPik</h3>
            </div>
            <ul className="space-y-3">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex gap-3 text-sm text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-7 ring-1 ring-brand-200">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center icon-gradient-green">
                <CheckCircle2 size={18} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">With PayNPik</h3>
            </div>
            <ul className="space-y-3">
              {SOLUTIONS.map((s) => (
                <li key={s} className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 size={14} className="text-emerald-600 mt-1 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
