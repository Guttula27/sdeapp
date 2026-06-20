import { Outlet as RouterOutlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Store,
  BarChart3, ChefHat, Settings, LogOut, Bell, User,
  ChevronDown, ChevronRight, Users, ShieldAlert, Building2, CreditCard,
  Gauge, Menu, Flame, Tag, Sandwich, Plus, LayoutGrid, Shield, Languages, ConciergeBell,
  Plug, MessageCircle, ClipboardCheck, MessageSquare, Network,
  Ticket, Percent as PercentIcon, Package, Gift, Award,
  CloudOff, Wallet, RotateCcw,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { useUserRole, UserTier } from '../../hooks/useUserRole';
import { allowsSeating } from '../../utils/outletType';
import api from '../../services/api';

// Nav routes that only make sense for outlets that actually seat
// customers — dine-in sections, service-station assignment, and the
// service-desk handoff lane. Hidden when the signed-in user belongs
// to a SELF_SERVICE / SELF_SERVICE_PARCEL outlet.
const SEATING_ONLY_PATHS = new Set([
  '/service-desk',
  '/table-types',
  '/service-stations',
]);

function scrubSeatingNav(items: NavItem[]): NavItem[] {
  return items
    .map((it): NavItem | null => {
      if (SEATING_ONLY_PATHS.has(it.to)) return null;
      if (it.children) {
        const kept = it.children.filter((c) => !SEATING_ONLY_PATHS.has(c.to));
        if (kept.length === 0 && SEATING_ONLY_PATHS.has(it.to)) return null;
        return { ...it, children: kept };
      }
      return it;
    })
    .filter((x): x is NavItem => x !== null);
}

// Removes the Aggregators settings sub-page (+ any future top-level
// aggregator entry) from the nav when the outlet's business admin
// hasn't enabled the feature. Walks top-level + Settings children
// like scrubSeatingNav does; "/aggregators/*" matches the bulk
// mappings page too.
function stripAggregatorsNav(items: NavItem[]): NavItem[] {
  const isAggregator = (path: string) =>
    path === '/aggregators' || path.startsWith('/aggregators/');
  return items
    .map((it): NavItem | null => {
      if (isAggregator(it.to)) return null;
      if (it.children) {
        const kept = it.children.filter((c) => !isAggregator(c.to));
        return { ...it, children: kept };
      }
      return it;
    })
    .filter((x): x is NavItem => x !== null);
}

// Service Stations are an extension of Dine-In Sections — a service
// station maps staff to a set of tables inside a section. With zero
// sections, the Service Stations form has nothing to assign to, so we
// disable the nav link until at least one section has been created.
// Walks both top-level entries and Settings children.
function disableServiceStationsIfNoSections(items: NavItem[], hasSections: boolean): NavItem[] {
  if (hasSections) return items;
  const mark = (it: NavItem): NavItem =>
    it.to === '/service-stations'
      ? { ...it, disabled: true, disabledReason: 'Create at least one Dine-In Section first' }
      : it;
  return items.map((it) =>
    it.children
      ? { ...mark(it), children: it.children.map(mark) }
      : mark(it),
  );
}

/* ── nav config ──────────────────────────────────────────── */
// `requires` lists responsibilities that gate the item — visible when the
// user has at least one of them. Items with no `requires` are always visible.
// Today this is consulted only for non-admin users (MINIMAL_NAV); the three
// admin sidebars below ignore `requires` and render every item.
type NavItem = {
  to: string;
  icon: any;
  label: string;
  requires?: string[];
  children?: NavItem[];
  // When true, render the row as visibly disabled (greyed) and ignore
  // clicks. Used for items whose prerequisite hasn't been set up yet
  // (e.g. Service Stations until Dine-In Sections exist).
  disabled?: boolean;
  disabledReason?: string;
};

// Sub-sections that hang under "Settings" for each tier. Routes themselves
// remain unchanged so deep links keep working.
const SETTINGS_CHILDREN: Record<UserTier, NavItem[]> = {
  platform: [
    { to: '/settings',  icon: User,      label: 'Account' },
    { to: '/roles',     icon: Shield,    label: 'Roles' },
    { to: '/languages', icon: Languages, label: 'Languages' },
    { to: '/integrations', icon: Plug,           label: 'Integrations' },
    { to: '/template-approvals', icon: ClipboardCheck, label: 'Template Approvals' },
  ],
  business: [
    { to: '/settings', icon: User,   label: 'Account' },
    { to: '/roles',    icon: Shield, label: 'Roles' },
    { to: '/messaging', icon: MessageCircle, label: 'Messaging' },
  ],
  outlet: [
    { to: '/settings',    icon: User,       label: 'Account' },
    { to: '/roles',       icon: Shield,     label: 'Roles' },
    { to: '/tags',        icon: Tag,        label: 'Tags' },
    { to: '/table-types', icon: LayoutGrid, label: 'Dine In Sections' },
    { to: '/stations',    icon: Flame,      label: 'Stations' },
    { to: '/service-stations', icon: ConciergeBell, label: 'Service Stations' },
    { to: '/toppings',    icon: Sandwich,   label: 'Toppings' },
    { to: '/messaging',   icon: MessageCircle, label: 'Messaging' },
    { to: '/aggregators', icon: Plug,       label: 'Aggregators' },
  ],
  kitchen: [{ to: '/settings', icon: User, label: 'Account' }],
  counter: [{ to: '/settings', icon: User, label: 'Account' }],
  store:   [{ to: '/settings', icon: User, label: 'Account' }],
};

const NAV: Record<UserTier, NavItem[]> = {
  platform: [
    { to: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/platform',           icon: Gauge,           label: 'Overview' },
    { to: '/businesses',         icon: Building2,       label: 'Businesses' },
    { to: '/orders',             icon: ShoppingBag,     label: 'Orders' },
    { to: '/subscriptions-mgmt', icon: CreditCard,      label: 'Plans' },
    { to: '/platform-settings',  icon: PercentIcon,     label: 'Fees' },
    { to: '/settings',           icon: Settings,        label: 'Settings', children: SETTINGS_CHILDREN.platform },
  ],
  business: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/business',  icon: Building2,       label: 'Business' },
    { to: '/outlets',   icon: Store,           label: 'Outlets' },
    { to: '/menu',      icon: UtensilsCrossed, label: 'Menu' },
    { to: '/orders',    icon: ShoppingBag,     label: 'Orders' },
    { to: '/promotions/coupons', icon: Ticket, label: 'Promotions', children: [
      { to: '/promotions/coupons',   icon: Ticket,      label: 'Coupons' },
      { to: '/promotions/discounts', icon: PercentIcon, label: 'Discounts' },
      { to: '/promotions/offers',    icon: Gift,        label: 'Offers' },
      { to: '/promotions/rewards',   icon: Award,       label: 'Rewards' },
    ]},
    { to: '/disputes',  icon: ShieldAlert,     label: 'Disputes' },
    { to: '/feedback',  icon: MessageSquare,   label: 'Feedback' },
    { to: '/reports',   icon: BarChart3,       label: 'Reports' },
    { to: '/staff',     icon: Users,           label: 'Staff' },
    { to: '/settings',  icon: Settings,        label: 'Settings', children: SETTINGS_CHILDREN.business },
  ],
  outlet: [
    { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/outlet-profile',  icon: Store,           label: 'Outlet' },
    { to: '/place-order',     icon: Plus,            label: 'Place Order' },
    { to: '/orders',    icon: ShoppingBag,     label: 'Orders' },
    { to: '/menu',      icon: UtensilsCrossed, label: 'Menu' },
    { to: '/promotions/coupons', icon: Ticket, label: 'Promotions', children: [
      { to: '/promotions/coupons',   icon: Ticket,      label: 'Coupons' },
      { to: '/promotions/discounts', icon: PercentIcon, label: 'Discounts' },
      { to: '/promotions/offers',    icon: Gift,        label: 'Offers' },
      { to: '/promotions/rewards',   icon: Award,       label: 'Rewards' },
    ]},
    { to: '/customers', icon: Users,           label: 'Customers' },
    { to: '/kitchen',   icon: ChefHat,         label: 'Kitchen' },
    { to: '/service-desk', icon: ConciergeBell, label: 'Service Desk' },
    { to: '/parcel-desk',  icon: Package,       label: 'Parcel Desk' },
    { to: '/offline-orders', icon: CloudOff,    label: 'Offline Orders' },
    { to: '/shifts',    icon: Wallet,          label: 'Shifts' },
    { to: '/refunds',   icon: RotateCcw,       label: 'Refunds' },
    { to: '/disputes',  icon: ShieldAlert,     label: 'Disputes' },
    { to: '/feedback',  icon: MessageSquare,   label: 'Feedback' },
    { to: '/staff',     icon: Users,           label: 'Staff' },
    { to: '/reports',   icon: BarChart3,       label: 'Reports' },
    { to: '/settings',  icon: Settings,        label: 'Settings', children: SETTINGS_CHILDREN.outlet },
  ],
  kitchen: [
    { to: '/kitchen',   icon: ChefHat,         label: 'Kitchen' },
    { to: '/orders',    icon: ShoppingBag,     label: 'Orders' },
    { to: '/settings',  icon: Settings,        label: 'Settings' },
  ],
  counter: [
    { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/place-order', icon: Plus,            label: 'Place Order' },
    { to: '/orders',      icon: ShoppingBag,     label: 'Orders' },
    { to: '/menu',      icon: UtensilsCrossed, label: 'Menu' },
    { to: '/disputes',  icon: ShieldAlert,     label: 'Disputes' },
    { to: '/settings',  icon: Settings,        label: 'Settings' },
  ],
  store: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/settings',  icon: Settings,        label: 'Settings' },
  ],
};

// Sidebar shown to any user whose role isn't one of the three admin roles
// (Platform Admin, Business Owner, Outlet Admin). Items are surfaced based
// on the user's responsibilities — Account is the only always-on row.
const MINIMAL_NAV: NavItem[] = [
  { to: '/place-order', icon: Plus,            label: 'Place Order', requires: ['CREATE_ORDER'] },
  { to: '/orders',      icon: ShoppingBag,     label: 'Orders',      requires: ['VIEW_ORDERS'] },
  { to: '/kitchen',     icon: ChefHat,         label: 'Kitchen',     requires: ['VIEW_KITCHEN'] },
  { to: '/service-desk', icon: ConciergeBell,  label: 'Service Desk', requires: ['VIEW_SERVICE_DESK'] },
  { to: '/parcel-desk',  icon: Package,        label: 'Parcel Desk',  requires: ['VIEW_PARCEL_DESK'] },
  { to: '/offline-orders', icon: CloudOff,     label: 'Offline Orders', requires: ['CREATE_ORDER'] },
  { to: '/shifts',         icon: Wallet,       label: 'Shifts',          requires: ['CREATE_ORDER', 'COLLECT_PAYMENT'] },
  { to: '/refunds',        icon: RotateCcw,    label: 'Refunds',         requires: ['CANCEL_ORDER'] },
  { to: '/menu',        icon: UtensilsCrossed, label: 'Menu',        requires: ['VIEW_MENU'] },
  { to: '/customers',   icon: Users,           label: 'Customers',   requires: ['VIEW_CUSTOMERS'] },
  { to: '/disputes',    icon: ShieldAlert,     label: 'Disputes',    requires: ['VIEW_DISPUTES'] },
  { to: '/feedback',    icon: MessageSquare,   label: 'Feedback',    requires: ['MANAGE_DISPUTES', 'MANAGE_CUSTOMERS'] },
  { to: '/reports',     icon: BarChart3,       label: 'Reports',     requires: ['VIEW_REPORTS'] },
  { to: '/settings',    icon: Settings,        label: 'Settings', children: [
    { to: '/settings',    icon: User,       label: 'Account' },
    { to: '/roles',       icon: Shield,     label: 'Roles',           requires: ['MANAGE_ROLES'] },
    { to: '/tags',        icon: Tag,        label: 'Tags',            requires: ['MANAGE_CUSTOMER_TAGS'] },
    { to: '/table-types', icon: LayoutGrid, label: 'Dine In Sections', requires: ['MANAGE_TABLE_TYPES'] },
    { to: '/stations',    icon: Flame,      label: 'Stations',        requires: ['MANAGE_KITCHEN_STATIONS'] },
    { to: '/toppings',    icon: Sandwich,   label: 'Toppings',        requires: ['MANAGE_TOPPINGS'] },
  ]},
];

// Cluster Owner sidebar — overrides the standard `business` NAV when the
// signed-in user's business is a cluster. The cluster doesn't own outlets
// or a menu of its own, so swapping in cluster-shaped nav items keeps the
// owner from landing on empty pages. Each link goes to a route that
// understands the cluster context.
const buildClusterNav = (businessId: string): NavItem[] => [
  { to: `/platform/clusters/${businessId}`, icon: Network, label: 'Cluster' },
  { to: '/orders',   icon: ShoppingBag,  label: 'Orders' },
  { to: '/reports',  icon: BarChart3,    label: 'Reports' },
  { to: '/staff',    icon: Users,        label: 'Staff' },
  { to: '/settings', icon: Settings,     label: 'Settings', children: SETTINGS_CHILDREN.business },
];

// Admin roles get the full tier sidebar; everyone else gets MINIMAL_NAV
// filtered by their responsibilities. Match by exact name (case-insensitive)
// so custom roles like "Cook" or "Cashier" fall through to the minimal view.
const ADMIN_ROLE_NAMES = new Set(['platform admin', 'business owner', 'outlet admin']);
function isAdminRole(name: string | undefined | null): boolean {
  return !!name && ADMIN_ROLE_NAMES.has(name.trim().toLowerCase());
}

/** Drop items whose `requires` aren't satisfied; collapse parents that lose
 *  all their children. Items without a `requires` field stay (e.g. Account). */
function filterNav(items: NavItem[], has: (p: string) => boolean): NavItem[] {
  const allowed = (item: NavItem) => !item.requires?.length || item.requires.some(has);
  return items
    .map((item): NavItem | null => {
      if (item.children) {
        const visibleChildren = item.children.filter(allowed);
        if (!visibleChildren.length) return null;
        return { ...item, children: visibleChildren };
      }
      return allowed(item) ? item : null;
    })
    .filter((x): x is NavItem => x !== null);
}

/* ── nav row (handles flat + nested) ─────────────────────── */
function NavRow({ item, compact, onNavigate }: { item: NavItem; compact?: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const hasChildren = !!item.children?.length;
  const childPaths = item.children?.map((c) => c.to) ?? [];
  const childActive = childPaths.some((p) => p && (location.pathname === p || location.pathname.startsWith(p + '/')));
  const selfActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');

  const [expanded, setExpanded] = useState(childActive || (hasChildren && selfActive));
  useEffect(() => {
    if (childActive) setExpanded(true);
  }, [childActive]);

  const rowClasses = (active: boolean) =>
    clsx(
      'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[.8125rem] font-medium transition-all duration-150 overflow-hidden w-full',
      active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
    );

  if (!hasChildren) {
    const Icon = item.icon;
    if (item.disabled) {
      // Render the row visibly but non-interactive. A `cursor-not-allowed`
      // pointer + dimmed colours tell the operator this is a future step,
      // and the title attribute surfaces why (e.g. "Create at least one
      // Dine-In Section first").
      return (
        <div
          title={item.disabledReason || `${item.label} unavailable`}
          aria-disabled
          className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[.8125rem] font-medium text-slate-600 opacity-50 cursor-not-allowed select-none"
        >
          <Icon size={17} className="shrink-0" />
          {!compact && <span className="animate-fade-in">{item.label}</span>}
        </div>
      );
    }
    return (
      <NavLink
        to={item.to}
        end={item.to === '/settings'}
        title={compact ? item.label : undefined}
        onClick={onNavigate}
        className={({ isActive }) => rowClasses(isActive)}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute inset-0 rounded-xl"
                style={{ background: 'linear-gradient(135deg, rgba(249,115,22,.25) 0%, rgba(234,88,12,.15) 100%)', border: '1px solid rgba(249,115,22,.2)' }} />
            )}
            <Icon size={17} className={clsx('shrink-0 relative z-10 transition-transform', !isActive && 'group-hover:scale-110', isActive && 'text-brand-400')} />
            {!compact && <span className="relative z-10 animate-fade-in">{item.label}</span>}
            {isActive && !compact && <span className="ml-auto relative z-10 w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />}
          </>
        )}
      </NavLink>
    );
  }

  const Icon = item.icon;
  const parentActive = selfActive || childActive;

  // Compact (collapsed sidebar): show parent as icon-only NavLink, expose
  // children via tooltip rows below it — falls through to the flat-link
  // pattern so users can still reach them by hovering the icon.
  if (compact) {
    return (
      <>
        <NavLink to={item.to} end title={item.label} onClick={onNavigate} className={rowClasses(parentActive)}>
          {({ isActive }) => (
            <>
              {(isActive || childActive) && (
                <span className="absolute inset-0 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(249,115,22,.25) 0%, rgba(234,88,12,.15) 100%)', border: '1px solid rgba(249,115,22,.2)' }} />
              )}
              <Icon size={17} className={clsx('shrink-0 relative z-10', (isActive || childActive) && 'text-brand-400')} />
            </>
          )}
        </NavLink>
        {item.children!.filter((c) => c.to !== item.to).map((c) => (
          <NavLink key={c.to} to={c.to} title={c.label} onClick={onNavigate} className={({ isActive }) => rowClasses(isActive)}>
            {({ isActive }) => {
              const ChildIcon = c.icon;
              return (
                <>
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl"
                      style={{ background: 'linear-gradient(135deg, rgba(249,115,22,.18) 0%, rgba(234,88,12,.1) 100%)', border: '1px solid rgba(249,115,22,.15)' }} />
                  )}
                  <ChildIcon size={15} className={clsx('shrink-0 relative z-10', isActive && 'text-brand-400')} />
                </>
              );
            }}
          </NavLink>
        ))}
      </>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={rowClasses(parentActive)}
      >
        {parentActive && (
          <span className="absolute inset-0 rounded-xl"
            style={{ background: 'linear-gradient(135deg, rgba(249,115,22,.25) 0%, rgba(234,88,12,.15) 100%)', border: '1px solid rgba(249,115,22,.2)' }} />
        )}
        <Icon size={17} className={clsx('shrink-0 relative z-10', parentActive && 'text-brand-400')} />
        <span className="relative z-10 flex-1 text-left">{item.label}</span>
        <ChevronRight
          size={13}
          className={clsx('relative z-10 text-slate-500 transition-transform duration-200', expanded && 'rotate-90')}
        />
      </button>
      {expanded && (
        <div className="ml-3 mt-0.5 pl-3 border-l border-white/5 space-y-0.5">
          {item.children!.map((c) => {
            const ChildIcon = c.icon;
            return (
              <NavLink
                key={c.to}
                to={c.to}
                end={c.to === '/settings'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[.78rem] font-medium transition-all duration-150',
                    isActive ? 'text-white bg-white/[.07]' : 'text-slate-400 hover:text-white hover:bg-white/[.04]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <ChildIcon size={14} className={clsx('shrink-0', isActive && 'text-brand-400')} />
                    <span>{c.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TIER_BADGE: Record<UserTier, { label: string; bg: string; dot: string }> = {
  platform: { label: 'Platform Admin', bg: 'bg-violet-500/15 text-violet-300',  dot: 'bg-violet-400' },
  business: { label: 'Business Admin', bg: 'bg-sky-500/15 text-sky-300',        dot: 'bg-sky-400' },
  outlet:   { label: 'Outlet Admin',   bg: 'bg-brand-700/15 text-brand-300',  dot: 'bg-brand-400' },
  kitchen:  { label: 'Kitchen Staff',  bg: 'bg-emerald-500/15 text-emerald-300',dot: 'bg-emerald-400' },
  counter:  { label: 'Counter Staff',  bg: 'bg-amber-500/15 text-amber-300',    dot: 'bg-amber-400' },
  store:    { label: 'Store Staff',    bg: 'bg-teal-500/15 text-teal-300',      dot: 'bg-teal-400' },
};

/* ── main layout ─────────────────────────────────────────── */
export default function Layout() {
  const dispatch  = useDispatch<AppDispatch>();
  const navigate  = useNavigate();
  const { tier, has, user, isClusterOwner } = useUserRole();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [userMenu, setUserMenu]       = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => { dispatch(logout()); navigate('/login'); };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Service Stations depends on the outlet having at least one
  // Dine-In Section configured — without sections the form has
  // nothing to assign staff to. We probe the table-types endpoint
  // once on mount for outlet-tier users so the nav can grey the link
  // until they create a section. Re-runs whenever the operator
  // switches outlets (defensive — that's a logout/login flow today).
  // `null` = still loading → nav renders normally so the link doesn't
  // flicker disabled then enabled.
  const [hasSections, setHasSections] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user?.outletId) {
      setHasSections(true); // not an outlet-tier user → don't apply the gate
      return;
    }
    let cancelled = false;
    api.get(`/outlets/${user.outletId}/table-types`)
      .then(({ data }) => {
        if (!cancelled) {
          const rows = Array.isArray(data?.data) ? data.data : [];
          setHasSections(rows.length > 0);
        }
      })
      .catch(() => { if (!cancelled) setHasSections(true); });
    return () => { cancelled = true; };
  }, [user?.outletId]);

  // Cluster Owners get a cluster-shaped sidebar even though their tier is
  // `business`. Everyone else falls back to the standard rules.
  const rawNav = isClusterOwner && user?.businessId
    ? buildClusterNav(user.businessId)
    : isAdminRole(user?.role?.name)
      ? (NAV[tier] || NAV.outlet)
      : filterNav(MINIMAL_NAV, has);
  // Self-service outlets don't need dine-in sections, service stations
  // or the service desk lane — strip those entries from the nav.
  // outletType is sourced from the JWT-derived auth user; until that
  // field arrives the strip is a no-op so the standard nav still renders.
  const outletType = user?.outlet?.outletType as string | undefined;
  const scrubbed = !!user?.outletId && outletType && !allowsSeating(outletType)
    ? scrubSeatingNav(rawNav)
    : rawNav;
  // Per-outlet aggregator feature toggle owned by the business admin
  // (paynpik_outlets.aggregatorEnabled). When false, the outlet admin
  // shouldn't even see the Aggregators settings sub-page, let alone
  // configure integrations.
  const aggregatorEnabled = !!(user?.outlet as any)?.aggregatorEnabled;
  const afterAggregatorGate = aggregatorEnabled ? scrubbed : stripAggregatorsNav(scrubbed);
  // Dine-in outlet with no sections yet → grey out the Service
  // Stations nav row (still visible so the operator can see it's a
  // future step, but non-clickable with a tooltip explaining why).
  const navItems = hasSections === false
    ? disableServiceStationsIfNoSections(afterAggregatorGate, false)
    : afterAggregatorGate;
  // Label = the user's actual role name. When the user has no role assigned
  // we hide the badge entirely instead of falling back to a misleading tier
  // label like "Outlet Admin". Tier still drives the color palette.
  const roleLabel = user?.role?.name?.trim() || '';
  const tierBadge = TIER_BADGE[tier];
  const badge = { ...tierBadge, label: roleLabel };

  const SidebarContent = ({ compact }: { compact?: boolean }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/6 shrink-0">
        <img src="/logo.png" alt="VEZEOR" className="w-8 h-8 shrink-0 object-contain" />
        {!compact && (
          <div className="animate-fade-in overflow-hidden">
            <p className="text-white font-bold text-sm tracking-tight leading-none">VEZEOR</p>
            {badge.label && (
              <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.bg}`}>
                <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
                {badge.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-0.5">
        {navItems.map((item) => (
          <NavRow key={item.to} item={item} compact={compact} onNavigate={() => setMobileSidebar(false)} />
        ))}
      </nav>

      {/* User panel */}
      <div className="shrink-0 px-3 pb-4 pt-3 border-t border-white/6">
        {!compact ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-default">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg,#0B4245,#073032)' }}>
              {user?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.role?.name}</p>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button onClick={handleLogout} title="Sign out"
            className="w-full flex items-center justify-center p-2.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={17} />
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f2f8' }}>

      {/* ── Sidebar (desktop) ─────────────────────────────── */}
      <aside className={clsx(
        'hidden lg:flex flex-col border-r border-white/5 shrink-0 transition-all duration-300',
        sidebarOpen ? 'w-60' : 'w-[68px]',
      )} style={{ background: 'linear-gradient(180deg, #0a0f1e 0%, #0f172a 100%)' }}>
        <SidebarContent compact={!sidebarOpen} />
      </aside>

      {/* ── Mobile sidebar overlay ────────────────────────── */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebar(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col shadow-xl"
            style={{ background: 'linear-gradient(180deg, #0a0f1e 0%, #0f172a 100%)' }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main area ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-15 bg-white border-b border-slate-100/80 px-5 flex items-center justify-between shrink-0 z-10"
          style={{ boxShadow: '0 1px 0 #e8eaf0, 0 1px 4px rgb(0 0 0 / .04)', height: '56px' }}>
          <div className="flex items-center gap-3">
            {/* Desktop collapse toggle */}
            <button onClick={() => setSidebarOpen(v => !v)}
              className="hidden lg:flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <Menu size={17} />
            </button>
            {/* Mobile open */}
            <button onClick={() => setMobileSidebar(true)}
              className="lg:hidden flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <Menu size={17} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative flex items-center justify-center w-9 h-9 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-700 ring-2 ring-white" />
            </button>

            {/* User dropdown */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setUserMenu(v => !v)}
                className={clsx(
                  'flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl border-[1.5px] transition-all duration-150',
                  userMenu
                    ? 'bg-brand-50 border-brand-300 shadow-[0_0_0_3px_rgb(249_115_22_/_0.12)]'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-slate-300',
                )}>
                <div className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                  style={{ width: '26px', height: '26px', background: 'linear-gradient(135deg,#0B4245,#073032)' }}>
                  {user?.name?.[0]}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-[12px] font-semibold text-slate-800">{user?.name}</p>
                  {badge.label && <p className="text-[10px] text-slate-400">{badge.label}</p>}
                </div>
                <ChevronDown size={12} className={clsx('text-slate-400 transition-transform duration-200', userMenu && 'rotate-180')} />
              </button>

              {userMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-pop border border-slate-100 overflow-hidden z-50 animate-slide-down">
                  <div className="px-4 py-3.5" style={{ background: 'linear-gradient(135deg,#0B4245,#073032)' }}>
                    <p className="text-sm font-bold text-white">{user?.name}</p>
                    <p className="text-[11px] text-brand-100 mt-0.5">{user?.phone}</p>
                    {badge.label && (
                      <span className="inline-block mt-2 text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div className="py-1">
                    <button onClick={() => { setUserMenu(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors">
                      <User size={14} className="text-slate-400" /> Profile & Settings
                    </button>
                  </div>
                  <div className="border-t border-slate-100 py-1">
                    <button onClick={() => { setUserMenu(false); handleLogout(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition-colors font-medium">
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto page-bg">
          <div className="p-6 max-w-screen-2xl mx-auto">
            <RouterOutlet />
          </div>
        </main>
      </div>
    </div>
  );
}
