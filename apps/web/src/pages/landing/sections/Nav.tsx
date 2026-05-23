import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: '#features',  label: 'Features' },
  { href: '#diner',     label: 'For diners' },
  { href: '#audience',  label: 'For you' },
  { href: '#pricing',   label: 'Pricing' },
  { href: '#faq',       label: 'FAQ' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${
        scrolled ? 'bg-white/85 backdrop-blur-lg border-b border-slate-200/60' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-md"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
          >
            P
          </div>
          <span className="font-black text-slate-900 text-lg tracking-tight">PayNPik</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link to="/login" className="btn-ghost">Sign in</Link>
          <a href="#cta" className="btn-primary">Book a demo</a>
        </div>

        <button
          aria-label="Toggle menu"
          className="md:hidden btn-ghost"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-slate-200 px-6 py-4 space-y-2 animate-slide-down">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700"
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 pt-3">
            <Link to="/login" className="btn-secondary flex-1" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <a href="#cta" className="btn-primary flex-1" onClick={() => setOpen(false)}>
              Book demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
