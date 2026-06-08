import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features',    href: '#features' },
      { label: 'How it works', href: '#how' },
      { label: 'Pricing',     href: '#pricing' },
      { label: 'FAQ',         href: '#faq' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'Dine-in',       href: '#audience' },
      { label: 'QSR',           href: '#audience' },
      { label: 'Food court',    href: '#audience' },
      { label: 'Cloud kitchen', href: '#audience' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog',  href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#cta' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-md"
                style={{ background: 'linear-gradient(135deg,#0B4245,#073032)' }}>P</div>
              <span className="font-black text-slate-900 text-lg tracking-tight">PayNPik</span>
            </div>
            <p className="mt-4 text-sm text-slate-600 max-w-xs leading-relaxed">
              The all-in-one platform for modern restaurants. QR ordering, kitchen display,
              payments and analytics — on one screen.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> hello@paynpik.com</li>
              <li className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> +91 80 4567 8900</li>
              <li className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> Bengaluru, India</li>
            </ul>
          </div>

          {COLUMNS.map((c) => (
            <div key={c.title}>
              <h4 className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">{c.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-slate-600 hover:text-brand-600 transition-colors">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-600" /> GST-compliant billing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-600" /> PCI DSS-aligned payment flows
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-600" /> JWT auth, encryption in transit &amp; at rest
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-600" /> Audit-logged actions
          </span>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} PayNPik. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs">
            <a href="#" className="text-slate-500 hover:text-slate-700">Privacy</a>
            <a href="#" className="text-slate-500 hover:text-slate-700">Terms</a>
            <Link to="/login" className="text-slate-500 hover:text-slate-700">Sign in</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
