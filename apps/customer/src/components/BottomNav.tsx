import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, Gift, User, QrCode } from 'lucide-react';
import clsx from 'clsx';

const SIDE_TABS = [
  { to: '/home',      icon: Home,            label: 'Home' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  // — floating scan in the middle —
  { to: '/offers',    icon: Gift,            label: 'Offers' },
  { to: '/profile',   icon: User,            label: 'Profile' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const scanActive = location.pathname.startsWith('/scan');

  return (
    // h-dvh + overflow-hidden locks the shell to the visible viewport
    // so the inner <main> can be the page's scroll container. Without
    // this the body scrolled on mobile (h-dvh-aware pages still had
    // min-h-dvh on the parent letting it grow past the viewport),
    // taking the sticky header along with it and leaving an empty
    // gap above the nav. The nav is now in-flow inside the flex
    // column rather than fixed — pages no longer need their own
    // pb-24 to clear it.
    <div className="flex flex-col h-dvh bg-slate-50 overflow-hidden">
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,.04)] z-40 shrink-0">
        <div className="max-w-md mx-auto grid grid-cols-5 relative">
          {/* 2 left tabs */}
          {SIDE_TABS.slice(0, 2).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                  isActive ? 'text-brand-500' : 'text-slate-400 hover:text-slate-600',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={clsx('text-[10px] font-semibold', isActive && 'font-bold')}>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Center floating Scan button */}
          <div className="relative flex items-end justify-center pb-2 pt-3">
            <button
              onClick={() => navigate('/scan')}
              className={clsx(
                'absolute -top-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95',
                scanActive
                  ? 'bg-gradient-to-br from-brand-600 to-brand-800 ring-4 ring-brand-100'
                  : 'bg-gradient-to-br from-brand-500 to-brand-400',
              )}
              aria-label="Scan QR"
            >
              <QrCode size={22} className="text-white" />
            </button>
            <span className={clsx(
              'text-[10px] font-semibold mt-7',
              scanActive ? 'text-brand-500 font-bold' : 'text-slate-400',
            )}>
              Scan
            </span>
          </div>

          {/* 2 right tabs */}
          {SIDE_TABS.slice(2).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                  isActive ? 'text-brand-500' : 'text-slate-400 hover:text-slate-600',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={clsx('text-[10px] font-semibold', isActive && 'font-bold')}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
