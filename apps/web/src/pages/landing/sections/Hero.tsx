import { ArrowRight, Play, ShieldCheck, Zap } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background flourishes */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,.18) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,.15) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[.4]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(226 232 240 / .5) 1px, transparent 1px), linear-gradient(90deg, rgb(226 232 240 / .5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs">
            <span className="dot-live" />
            <span className="text-xs font-semibold text-slate-700">Built for restaurants, food courts &amp; cloud kitchens</span>
          </div>

          <h1 className="mt-6 text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.05]">
            Run your restaurant<br />
            on <span className="text-gradient-brand">one screen.</span>
          </h1>

          <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0">
            QR ordering, live kitchen display, payments, inventory, workforce and analytics —
            for single outlets, multi-location brands and shared facilities like malls and food courts.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center justify-center lg:justify-start">
            <a href="#cta" className="btn-primary btn-lg">
              Book a free demo <ArrowRight size={16} />
            </a>
            <a href="#how" className="btn-secondary btn-lg">
              <Play size={14} /> See how it works
            </a>
          </div>

          <div className="mt-6 flex items-center gap-5 text-xs text-slate-500 justify-center lg:justify-start">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" /> GST-compliant billing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" /> Fast onboarding
            </span>
          </div>
        </div>

        {/* Visual mock */}
        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      {/* Dashboard mock */}
      <div className="card-flat shadow-pop rounded-2xl overflow-hidden border-slate-200/80">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/60">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-3 text-xs font-mono text-slate-400">paynpik.com/dashboard</span>
        </div>
        <div className="p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Today</p>
              <p className="text-xl font-black text-slate-900">Brigade Road Outlet</p>
            </div>
            <span className="badge badge-green"><span className="dot-live" /> Live</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Revenue',  value: '₹84,210', delta: '+12%' },
              { label: 'Orders',   value: '142',     delta: '+8%'  },
              { label: 'Avg time', value: '12 min',  delta: '-3 min' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-100 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{s.label}</p>
                <p className="text-base font-black text-slate-900 mt-1">{s.value}</p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{s.delta}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {[
              { id: '#1042', tbl: 'T-07', status: 'PREPARING', tone: 'badge-yellow' },
              { id: '#1041', tbl: 'T-12', status: 'READY',     tone: 'badge-green'  },
              { id: '#1040', tbl: 'T-04', status: 'NEW',       tone: 'badge-blue'   },
            ].map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">{o.id}</span>
                  <span className="text-sm font-semibold text-slate-700">Table {o.tbl}</span>
                </div>
                <span className={`badge ${o.tone}`}>{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Phone mock */}
      <div className="absolute -bottom-8 -left-6 w-44 hidden md:block">
        <div className="card-flat shadow-lg rounded-3xl overflow-hidden border-slate-200/80 p-3 bg-white">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Order #1042</div>
          <div className="mt-1.5 text-sm font-black text-slate-900">Preparing</div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="h-1.5 w-6 rounded-full bg-emerald-500" />
            <span className="h-1.5 w-6 rounded-full bg-emerald-500" />
            <span className="h-1.5 w-6 rounded-full bg-amber-400" />
            <span className="h-1.5 w-6 rounded-full bg-slate-200" />
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Live updates · No refresh</p>
        </div>
      </div>
    </div>
  );
}
