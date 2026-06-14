import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';

const LEGAL_LINKS = [
  { to: '/legal/terms',      label: 'Terms of Service' },
  { to: '/legal/privacy',    label: 'Privacy Policy' },
  { to: '/legal/refund',     label: 'Refund Policy' },
  { to: '/legal/agreement',  label: 'Merchant Agreement' },
];

type Props = {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  current: string;
  children: React.ReactNode;
};

export default function LegalLayout({ title, subtitle, lastUpdated, current, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="VEZEOR" className="w-9 h-9 object-contain" />
            <span className="font-black text-slate-900 text-lg tracking-tight">VEZEOR</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5">
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-[220px_1fr] gap-10">
        <aside className="lg:sticky lg:top-6 self-start">
          <h3 className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 mb-3">Legal</h3>
          <nav className="space-y-1">
            {LEGAL_LINKS.map((l) => {
              const active = l.to === current;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {l.label}
                  {active && <ChevronRight size={14} />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 text-xs text-slate-500">
            Questions? <a href="mailto:hello@vezeor.com" className="text-brand-600 hover:text-brand-700 font-semibold">hello@vezeor.com</a>
          </div>
        </aside>

        <main className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-8 py-7 border-b border-slate-100">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-brand-600">VEZEOR</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
            <p className="mt-3 text-xs text-slate-500"><span className="font-semibold">Last updated:</span> {lastUpdated}</p>
          </div>

          <div className="px-8 py-8 legal-prose">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
