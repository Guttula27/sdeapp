import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, ShoppingCart, X, Plus, Minus, Network, Store, Trash2, Loader2, ShieldCheck, ChevronRight, Heart, Clock } from 'lucide-react';
import api from '../services/api';
import { cachedGet } from '../utils/cachedGet';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import {
  ClusterCartLine, ClusterCartTopping, readClusterCart, writeClusterCart,
  makeClusterLineId, upsertLine as upsertCartLine,
} from '../utils/clusterCart';

// ── Cluster bundle shape ────────────────────────────────────
type ClusterItem = {
  id: string; name: string; basePrice: string | number; thumbnailUrl?: string | null;
  imageUrl?: string | null; shortDescription?: string | null; isAvailable: boolean;
  variants?: Array<{ id: string; name: string; price: string | number }>;
  // Surfaces whether the item needs the detail-page customisation flow.
  // Full topping payload is on the detail-page fetch.
  itemToppings?: Array<{ id: string }>;
};
type ClusterSubcategory = { id: string; name: string; displayOrder: number; imageUrl?: string | null; items: ClusterItem[] };
type ClusterCategory = {
  id: string; name: string; displayOrder: number; outletId: string;
  menuId?: string | null; imageUrl?: string | null;
  subcategories: ClusterSubcategory[];
};
type ClusterMenu = { id: string; name: string; isDefault: boolean };
type ClusterOutlet = {
  id: string; publicCode: string | null; name: string; logoUrl?: string | null;
  outletType: string; isActive: boolean; categories: ClusterCategory[]; menus: ClusterMenu[];
};
type Cluster = {
  id: string; publicCode: string; name: string; description?: string | null;
  address?: string | null; logoUrl?: string | null; thumbnailUrl?: string | null;
  primaryImageUrl?: string | null;
};

// Cart shape is now in utils/clusterCart so the item detail page can share it.
type CartLine = ClusterCartLine;

function priceFor(item: ClusterItem, variantId: string | null) {
  if (variantId && item.variants?.length) {
    const v = item.variants.find((vv) => vv.id === variantId);
    if (v) return Number(v.price);
  }
  return Number(item.basePrice);
}

export default function ClusterPage() {
  const { publicCode } = useParams<{ publicCode: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, user, token } = useCustomerAuth();

  const preselectOutletId = params.get('outletId') || '';
  const preselectTableId = params.get('tableId') || '';

  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [outlets, setOutlets] = useState<ClusterOutlet[]>([]);
  const [activeOutletId, setActiveOutletId] = useState<string>('');
  // Selected MENU within the active outlet — mirrors the standalone
  // OrderPage's multi-menu tab strip. Auto-reselected on outlet switch.
  const [activeMenuId, setActiveMenuId] = useState<string>('');
  // Selected CATEGORY within the active menu.
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  // Selected SUBCATEGORY within the active category — drives the right-pane
  // items list. Defaults to the category's first subcategory whenever the
  // category changes.
  const [activeSubId, setActiveSubId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Cart is backed by sessionStorage so navigating to the item detail page
  // and back doesn't drop the cart. Hydrated as soon as we know the cluster
  // id (in the load callback below) and re-synced on every change.
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [paying, setPaying] = useState(false);


  const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [cart]);
  const cartQty = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);

  // Tracks whether the bundle currently on screen came from the cache
  // fallback rather than a fresh network fetch. Drives the "viewing
  // cached menu" indicator + the cachedAt timestamp under it.
  const [bundleFromCache, setBundleFromCache] = useState(false);
  const [bundleCachedAt, setBundleCachedAt] = useState<number | null>(null);

  // ── Load cluster bundle ──────────────────────────────────
  const load = useCallback(async () => {
    if (!publicCode) return;
    setLoading(true);
    try {
      // Read-through cache: network wins when reachable, cached copy
      // surfaces when not. Customers walking into a mall food court
      // with patchy Wi-Fi still see the last menu they saw.
      const { data: bundle, fromCache, cachedAt } = await cachedGet<any>(
        `cluster-bundle:${publicCode}`,
        `/clusters/by-code/${publicCode}`,
      );
      setBundleFromCache(fromCache);
      setBundleCachedAt(cachedAt);
      setCluster(bundle.cluster);
      setOutlets(bundle.outlets || []);
      const initial = bundle.outlets?.find((o: ClusterOutlet) => o.id === preselectOutletId)
        || bundle.outlets?.find((o: ClusterOutlet) => o.isActive)
        || bundle.outlets?.[0];
      setActiveOutletId(initial?.id ?? '');
      // Rehydrate any cart we saved before — the user may have hopped to
      // the item detail page and is now coming back.
      if (bundle.cluster?.id) setCart(readClusterCart(bundle.cluster.id));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Cluster not found');
    } finally {
      setLoading(false);
    }
  }, [publicCode, preselectOutletId]);

  useEffect(() => { load(); }, [load]);

  // Refresh the bundle whenever the tab regains focus — catches admin
  // changes (item availability, price tweaks, new items) made while the
  // customer had the page open in the background. Throttled to 5s so we
  // don't hammer the API on rapid tab switches.
  useRefreshOnFocus(load);

  // Mirror every cart change to sessionStorage so the detail page sees fresh
  // state next time the user navigates over to it.
  useEffect(() => {
    if (cluster?.id) writeClusterCart(cluster.id, cart);
  }, [cart, cluster?.id]);

  const activeOutlet = outlets.find((o) => o.id === activeOutletId) ?? null;

  // ── Auto-select first menu when outlet changes ───────────
  // Prefer the default menu if multiple exist; else first one. Categories
  // without a menuId fall back to whichever menu we land on.
  useEffect(() => {
    if (!activeOutlet) { setActiveMenuId(''); return; }
    const menus = activeOutlet.menus;
    if (menus.length === 0) { setActiveMenuId(''); return; }
    const stillValid = menus.some((m) => m.id === activeMenuId);
    if (stillValid) return;
    const def = menus.find((m) => m.isDefault) ?? menus[0];
    setActiveMenuId(def.id);
  }, [activeOutlet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Categories visible under the active menu — empty means show everything
  // (single-menu outlet or unmenu'd legacy data).
  const visibleCategories = useMemo(() => {
    if (!activeOutlet) return [] as ClusterCategory[];
    const cats = [...activeOutlet.categories].sort((a, b) => a.displayOrder - b.displayOrder);
    if (activeOutlet.menus.length <= 1) return cats;
    return cats.filter((c) => c.menuId === activeMenuId);
  }, [activeOutlet, activeMenuId]);

  // Auto-select first category whenever the menu / outlet changes.
  useEffect(() => {
    if (visibleCategories.length === 0) { setActiveCategoryId(''); return; }
    if (visibleCategories.some((c) => c.id === activeCategoryId)) return;
    setActiveCategoryId(visibleCategories[0].id);
  }, [visibleCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCategory = visibleCategories.find((c) => c.id === activeCategoryId) ?? visibleCategories[0];
  const subcategories = useMemo(
    () => [...(activeCategory?.subcategories ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
    [activeCategory],
  );

  // Reselect first subcategory when category changes (or on first render).
  useEffect(() => {
    if (subcategories.length === 0) { setActiveSubId(''); return; }
    if (subcategories.some((s) => s.id === activeSubId)) return;
    setActiveSubId(subcategories[0].id);
  }, [subcategories]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSub = subcategories.find((s) => s.id === activeSubId) ?? subcategories[0];
  const itemsInSub = activeSub?.items ?? [];

  // ── Cart helpers (shared with item detail page via clusterCart util) ──
  const upsertLine = (line: CartLine, delta: number) => {
    setCart((prev) => upsertCartLine(prev, line, delta));
  };

  const addItem = (outlet: ClusterOutlet, item: ClusterItem, variantId: string | null) => {
    const unitPrice = priceFor(item, variantId);
    const variantName = variantId ? item.variants?.find((v) => v.id === variantId)?.name : null;
    const cartLineId = makeClusterLineId(outlet.id, item.id, variantId, undefined);
    upsertLine({
      cartLineId,
      outletId: outlet.id, outletName: outlet.name,
      itemId: item.id, itemName: item.name,
      variantId, variantName, unitPrice, quantity: 0,
    }, +1);
  };

  // Item row tap — always routes to the detail page. Even items without
  // variants or toppings benefit from the detail sheet (gallery, full
  // description, prep time, etc.). The cluster shell stays a quick browse
  // surface; commitment-to-add happens in the half-screen modal.
  const [detailContext, setDetailContext] = useState<{ item: any; outlet: ClusterOutlet } | null>(null);
  const onOpenItem = (outlet: ClusterOutlet, item: ClusterItem) => {
    setDetailContext({ item, outlet });
  };

  // Favorites toggle for the modal heart button. Cluster items don't carry
  // `isFavorite` from the bundle; the toggle calls the API and the UI
  // reflects optimistic state inside the open sheet.
  const toggleFavoriteInModal = async () => {
    if (!detailContext) return;
    if (!isLoggedIn) {
      toast('Sign in to save favourites', { icon: '🔐' });
      return;
    }
    const item = detailContext.item;
    const next = !item.isFavorite;
    setDetailContext((d) => (d ? { ...d, item: { ...d.item, isFavorite: next } } : d));
    try {
      if (next) await api.post(`/users/me/favorites/${item.id}`);
      else      await api.delete(`/users/me/favorites/${item.id}`);
    } catch {
      setDetailContext((d) => (d ? { ...d, item: { ...d.item, isFavorite: !next } } : d));
      toast.error('Failed to update favourite');
    }
  };

  // ── Checkout ─────────────────────────────────────────────
  const checkout = async (useBypass: boolean) => {
    if (!cluster || cart.length === 0) return;
    if (!isLoggedIn || !token) {
      toast.error('Please log in to place an order');
      navigate('/auth');
      return;
    }
    setPaying(true);
    try {
      const { data: created } = await api.post('/cluster-orders', {
        clusterBusinessId: cluster.id,
        tableId: preselectTableId || undefined,
        items: cart.map((l) => ({
          outletId: l.outletId,
          itemId: l.itemId,
          variantId: l.variantId || undefined,
          quantity: l.quantity,
          // Forward toppings in the canonical { toppingId, optionId? } shape
          // expected by OrdersService.resolveOrderItems.
          toppings: l.toppings?.length
            ? l.toppings.map((t) => ({ toppingId: t.toppingId, optionId: t.optionId }))
            : undefined,
        })),
      });
      const payload = created.data ?? created;
      const clusterOrderId = payload.clusterOrder?.id;
      if (!clusterOrderId) throw new Error('Could not create cluster order');

      if (useBypass) {
        await api.post(`/cluster-orders/${clusterOrderId}/bypass`);
        setCart([]); setCartOpen(false);
        toast.success('Order placed (test bypass) — your outlets are preparing');
        navigate(`/dashboard?clusterOrderId=${clusterOrderId}`);
        return;
      }

      const rp = payload.razorpay;
      if (!rp) throw new Error('Payment gateway unavailable — try the test bypass');

      if (rp.stubbed || rp.orderId?.startsWith('rp_stub_')) {
        await api.post(`/cluster-orders/${clusterOrderId}/verify`, {
          razorpayPaymentId: 'pay_stub_' + Math.random().toString(36).slice(2, 10),
          razorpaySignature: 'stub_signature',
        });
        setCart([]); setCartOpen(false);
        toast.success('Order placed — your outlets are preparing');
        navigate(`/dashboard?clusterOrderId=${clusterOrderId}`);
        return;
      }

      if (typeof window === 'undefined' || !(window as any).Razorpay) {
        toast.error('Payment gateway not loaded — refresh and try again');
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: rp.keyId, order_id: rp.orderId, amount: rp.amount, currency: rp.currency,
          name: cluster.name, description: `Cluster order ${cart.length} items`,
          prefill: user ? { name: user.name, contact: user.phone, email: user.email || undefined } : undefined,
          notes: { clusterOrderId },
          theme: { color: '#f97316' },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          handler: async (response: any) => {
            try {
              await api.post(`/cluster-orders/${clusterOrderId}/verify`, {
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              resolve();
            } catch (err) { reject(err); }
          },
        });
        rzp.on('payment.failed', (resp: any) => reject(new Error(resp?.error?.description || 'Payment failed')));
        rzp.open();
      });

      setCart([]); setCartOpen(false);
      toast.success('Order placed — your outlets are preparing');
      navigate(`/dashboard?clusterOrderId=${clusterOrderId}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message || 'Could not place order');
    } finally {
      setPaying(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }
  if (!cluster) return <div className="p-6 text-center text-slate-500">Cluster not found</div>;

  return (
    <div className="pb-40 bg-slate-50 min-h-screen">
      {/* ── Compact top bar — back + cluster name. No big hero band; the
          customer is in a known context (the cluster shell), so the
          screen real-estate goes to the menu instead. ─────────────── */}
      <div className="bg-white px-3 py-2.5 flex items-center gap-2 shadow-sm sticky top-0 z-30">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 shrink-0">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Network size={11} className="text-indigo-500 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-indigo-500">Cluster</span>
          </div>
          <p className="text-base font-black text-slate-900 leading-tight truncate">{cluster.name}</p>
        </div>
      </div>

      {/* Cached-menu indicator — only shown when the bundle came from
          the localStorage fallback. Auto-clears on next successful fetch. */}
      {bundleFromCache && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center gap-2 text-[11px] text-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-bold">Cached menu</span>
          {bundleCachedAt && (
            <span className="opacity-70">
              · last updated {Math.max(1, Math.round((Date.now() - bundleCachedAt) / 60000))}m ago
            </span>
          )}
          <button
            onClick={() => load()}
            className="ml-auto text-amber-900 font-bold underline underline-offset-2"
            title="Try to refresh from the network"
          >
            Refresh
          </button>
        </div>
      )}

      {/* ── Circular outlets row ──────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 sticky top-[57px] z-20">
        <div className="px-3 py-2.5">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {outlets.filter((o) => o.isActive).map((o) => {
              const active = o.id === activeOutletId;
              return (
                <button
                  key={o.id}
                  onClick={() => setActiveOutletId(o.id)}
                  className="shrink-0 flex flex-col items-center gap-1.5 group"
                  title={o.name}
                >
                  <div
                    className={
                      'w-14 h-14 rounded-full bg-white flex items-center justify-center overflow-hidden transition-all ' +
                      (active
                        ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white shadow-md'
                        : 'ring-1 ring-slate-200 shadow-sm hover:ring-slate-300')
                    }
                  >
                    {o.logoUrl ? (
                      <img src={o.logoUrl} alt={o.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                        <Store size={18} className="text-orange-500" />
                      </div>
                    )}
                  </div>
                  <span
                    className={
                      'text-[10px] font-semibold max-w-[64px] truncate ' +
                      (active ? 'text-slate-900' : 'text-slate-500')
                    }
                  >
                    {o.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Menu tab strip — only when the active outlet has >1 menu.
          Same dark-pill design as the standalone OrderPage so customers
          have one consistent mental model. ─────────────────────── */}
      {activeOutlet && activeOutlet.menus.length > 1 && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-2 border-b border-slate-700/50">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-1">Menu</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {activeOutlet.menus.map((m) => {
              const active = activeMenuId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMenuId(m.id)}
                  className={
                    'px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ' +
                    (active
                      ? 'bg-gradient-to-r from-brand-500 to-orange-400 text-white shadow-lg ring-1 ring-brand-300/50'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20')
                  }
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Categories — TOP horizontal pills (outlined active pattern).
          Active = brand border + light brand bg + brand text; inactive
          stays neutral. Single tier of nav under the menu strip. */}
      {visibleCategories.length > 0 && (
        <div className="bg-white border-b border-slate-100">
          {activeOutlet && activeOutlet.menus.length > 1 && (
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 px-3 pt-2 -mb-1">Categories</p>
          )}
          <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
            {visibleCategories.map((c) => {
              const active = c.id === (activeCategory?.id ?? '');
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategoryId(c.id)}
                  className={
                    'px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all border-[1.5px] ' +
                    (active
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50')
                  }
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Body: LEFT subcategory rail (thumbnails) + RIGHT items list.
          Subcategory rail uses the brand-tinted card treatment — 3px
          brand left-edge stripe + brand-50 background + brand text.
          Items use the outlined Add button pattern. */}
      {!activeOutlet ? (
        <div className="text-center text-slate-500 py-10">No outlet selected</div>
      ) : !activeCategory ? (
        <div className="text-center text-slate-500 py-10">No items in this menu</div>
      ) : (
        <div className="flex gap-0 mt-0">
          {/* LEFT rail — Subcategories with thumbnail + label. Skipped
              when the category has only one subcategory. */}
          {subcategories.length > 1 && (
            <aside className="w-24 sm:w-28 bg-slate-50/60 border-r border-slate-100 shrink-0">
              {subcategories.map((sub) => {
                const thumb = sub.imageUrl
                  || sub.items.find((i) => i.thumbnailUrl || i.imageUrl)?.thumbnailUrl
                  || sub.items.find((i) => i.thumbnailUrl || i.imageUrl)?.imageUrl;
                const active = sub.id === (activeSub?.id ?? '');
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubId(sub.id)}
                    className={
                      'flex flex-col items-center w-full px-2 py-3 gap-1.5 border-l-[3px] transition-all text-center ' +
                      (active
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-transparent hover:bg-slate-100/60')
                    }
                  >
                    <div
                      className={
                        'w-14 h-14 rounded-xl overflow-hidden border shrink-0 transition-all ' +
                        (active ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200')
                      }
                    >
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center text-base">🍽️</div>
                      )}
                    </div>
                    <span
                      className={
                        'text-[11px] font-bold leading-tight line-clamp-2 ' +
                        (active ? 'text-brand-700' : 'text-slate-600')
                      }
                    >
                      {sub.name}
                    </span>
                  </button>
                );
              })}
            </aside>
          )}

          {/* RIGHT pane — items in active subcategory */}
          <main className="flex-1 min-w-0 px-3 py-3 space-y-2">
            {itemsInSub.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-12">Currently there are no items available</p>
            ) : (
              itemsInSub.map((item) => {
                const qty = cart
                  .filter((c) => c.outletId === activeOutlet.id && c.itemId === item.id)
                  .reduce((s, l) => s + l.quantity, 0);
                const lowPrice = item.variants?.length
                  ? Math.min(...item.variants.map((v) => Number(v.price)))
                  : Number(item.basePrice);
                return (
                  <div
                    key={item.id}
                    onClick={() => onOpenItem(activeOutlet, item)}
                    role="button"
                    tabIndex={0}
                    className="bg-white rounded-2xl border border-slate-100 shadow-card p-3 flex gap-3 items-center cursor-pointer hover:border-brand-200 transition-colors"
                  >
                    {item.thumbnailUrl || item.imageUrl ? (
                      <img src={(item.thumbnailUrl || item.imageUrl)!} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xl">🍽️</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                      {item.shortDescription && <p className="text-[11px] text-slate-400 truncate">{item.shortDescription}</p>}
                      <p className="text-sm font-black text-brand-700 mt-0.5">
                        {item.variants?.length ? `from ₹${lowPrice.toFixed(0)}` : `₹${lowPrice.toFixed(0)}`}
                      </p>
                    </div>
                    {/* Outlined Add — white surface + brand border + brand text */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenItem(activeOutlet, item); }}
                      className={
                        'text-xs font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1 shrink-0 border-[1.5px] transition-colors ' +
                        (qty > 0
                          ? 'bg-brand-50 border-brand-500 text-brand-700'
                          : 'bg-white border-brand-500 text-brand-700 hover:bg-brand-50')
                      }
                    >
                      {qty > 0 ? <>Add · {qty} <ChevronRight size={12} /></> : <>+ Add</>}
                    </button>
                  </div>
                );
              })
            )}
          </main>
        </div>
      )}

      {/* ── Floating cart bar — branded pill with a split layout:
          [icon + items count] | [Cart total · items · arrow]
          Above the global BottomNav (which is fixed bottom-0 z-40 + a
          Scan button that pokes ~24px above it). bottom-24 + z-50
          keeps us above the nav both vertically and in stacking order. */}
      {cart.length > 0 && (
        <div className="fixed left-3 right-3 bottom-24 z-50">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-gradient-to-r from-brand-500 to-orange-500 text-white rounded-full shadow-xl flex items-center overflow-hidden border border-orange-400/40"
          >
            {/* Left section — a slightly inset capsule with the cart icon
                and the item count. Visually splits the pill into two. */}
            <span className="bg-white/15 backdrop-blur-sm pl-3 pr-4 py-2.5 flex items-center gap-2 rounded-full">
              <span className="w-7 h-7 rounded-full bg-white text-brand-600 flex items-center justify-center shadow-sm">
                <ShoppingCart size={14} />
              </span>
              <span className="text-xs font-bold leading-tight">
                {cartQty} item{cartQty !== 1 ? 's' : ''}
              </span>
            </span>
            {/* Right section — total + outlets + arrow CTA */}
            <span className="flex-1 px-3 py-2.5 flex items-center gap-2 text-left">
              <span className="flex-1 min-w-0">
                <span className="block text-[10px] opacity-80 leading-tight">
                  from {new Set(cart.map((c) => c.outletId)).size} outlet{new Set(cart.map((c) => c.outletId)).size !== 1 ? 's' : ''}
                </span>
                <span className="block text-sm font-black leading-tight">₹{cartTotal.toFixed(0)} <span className="text-[10px] opacity-80 font-semibold">Cart Total</span></span>
              </span>
              <ChevronRight size={18} className="opacity-90" />
            </span>
          </button>
        </div>
      )}


      {/* ── Cart review bottom-sheet ──────────────────────────── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => !paying && setCartOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">Your Cart</p>
                <p className="text-[11px] text-slate-500">{cluster.name}</p>
              </div>
              <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center" disabled={paying}>
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {Array.from(new Set(cart.map((c) => c.outletId))).map((outletId) => {
                const outletLines = cart.filter((c) => c.outletId === outletId);
                const outletName = outletLines[0]?.outletName ?? '';
                const outletSubtotal = outletLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
                return (
                  <div key={outletId}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Store size={12} className="text-slate-400" />
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">{outletName}</p>
                      <span className="ml-auto text-[11px] text-slate-500">₹{outletSubtotal.toFixed(0)}</span>
                    </div>
                    <div className="space-y-1.5">
                      {outletLines.map((l) => (
                        <div key={l.cartLineId} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{l.itemName}</p>
                            {l.variantName && <p className="text-[11px] text-slate-400">{l.variantName}</p>}
                            {l.toppings && l.toppings.length > 0 && (
                              <p className="text-[10px] text-indigo-600 truncate">
                                {l.toppings.map((t) => t.label).join(' · ')}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500">₹{l.unitPrice.toFixed(0)} each</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => upsertLine(l, -1)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                              <Minus size={12} />
                            </button>
                            <span className="text-sm font-bold w-5 text-center">{l.quantity}</span>
                            <button onClick={() => upsertLine(l, +1)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                              <Plus size={12} />
                            </button>
                            <button onClick={() => upsertLine(l, -l.quantity)} className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total</span>
                <span className="text-base font-black text-slate-900">₹{cartTotal.toFixed(0)}</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 flex items-center gap-2">
                <ShieldCheck size={14} className="text-indigo-600 shrink-0" />
                <p className="text-[11px] text-indigo-700 leading-tight">
                  Payment is split per outlet via Razorpay. One payment, multiple receipts.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => checkout(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={paying}
                >
                  Test Bypass
                </button>
                <button
                  onClick={() => checkout(false)}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 rounded-xl text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={paying}
                >
                  {paying ? <Loader2 size={14} className="animate-spin" /> : null}
                  Pay ₹{cartTotal.toFixed(0)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item detail bottom-sheet (half-screen) */}
      {detailContext && cluster && (
        <ClusterItemDetailModal
          clusterId={cluster.id}
          outlet={detailContext.outlet}
          item={detailContext.item}
          onClose={() => setDetailContext(null)}
          onToggleFavorite={toggleFavoriteInModal}
          onAdded={(qty, line) => {
            const prev = readClusterCart(cluster.id);
            const next = upsertCartLine(prev, line, qty);
            writeClusterCart(cluster.id, next);
            setCart(next);
            toast.success(`Added ${qty} × ${line.itemName}`);
            setDetailContext(null);
          }}
        />
      )}
    </div>
  );
}

/* ── Cluster item detail half-screen sheet ────────────────────────────
 * Mirrors OrderPage.ItemDetailModal but adapts to the cluster cart shape
 * (an item belongs to a specific outlet; the cart spans outlets). The
 * cluster bundle items already include full topping + variant payloads
 * — no extra fetch needed when opening the sheet.
 */
const CLUSTER_FOOD_GRADE_COLOR: Record<string, string> = { VEG: '#16a34a', NON_VEG: '#dc2626', VEGAN: '#0d9488' };
function ClusterFoodGradeDot({ grade }: { grade?: string }) {
  const color = CLUSTER_FOOD_GRADE_COLOR[grade || 'VEG'];
  return (
    <span
      title={(grade || 'VEG').replace('_', '-')}
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: 12, height: 12, border: `1.5px solid ${color}`, borderRadius: 2 }}
    >
      <span style={{ width: 6, height: 6, background: color, borderRadius: '50%' }} />
    </span>
  );
}

function ClusterItemDetailModal({
  clusterId, item, outlet, onClose, onToggleFavorite, onAdded,
}: {
  clusterId: string;
  item: any;
  outlet: ClusterOutlet;
  onClose: () => void;
  onToggleFavorite?: () => void;
  onAdded: (qty: number, line: ClusterCartLine) => void;
}) {
  void clusterId; // unused locally — parent persists; keep param for clarity
  const [variantId, setVariantId] = useState<string>(item.variants?.[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [topSel, setTopSel] = useState<Record<string, { selected: boolean; optionId?: string }>>(() => {
    const init: Record<string, { selected: boolean; optionId?: string }> = {};
    (item.itemToppings || []).forEach((l: any) => {
      if (l.topping?.options?.length) {
        init[l.toppingId] = { selected: !!l.isRequired, optionId: l.isRequired ? l.topping.options[0].id : undefined };
      } else {
        init[l.toppingId] = { selected: !!l.isRequired };
      }
    });
    return init;
  });

  const variant = item.variants?.find((v: any) => v.id === variantId);
  const basePrice = variant ? Number(variant.price) : Number(item.basePrice);
  const toppings: ClusterCartTopping[] = [];
  for (const link of item.itemToppings || []) {
    const sel = topSel[link.toppingId];
    if (!sel?.selected && !link.isRequired) continue;
    const linkAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping?.basePriceAdd ?? 0);
    if (link.topping?.options?.length) {
      const optId = sel?.optionId || link.topping.options[0].id;
      const opt = link.topping.options.find((o: any) => o.id === optId);
      if (!opt) continue;
      toppings.push({
        toppingId: link.toppingId, optionId: opt.id,
        label: `${link.topping.name}: ${opt.name}`,
        priceAdd: linkAdd + Number(opt.priceAdd),
      });
    } else {
      toppings.push({ toppingId: link.toppingId, label: link.topping?.name ?? '', priceAdd: linkAdd });
    }
  }
  const unitPrice = basePrice + toppings.reduce((s, t) => s + t.priceAdd, 0);
  const lineTotal = unitPrice * qty;
  const galleryImages = [item.imageUrl, ...(item.images?.map((g: any) => g.url) || [])].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl flex flex-col max-h-[80%]" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          {galleryImages.length > 0 ? (
            <div className="flex overflow-x-auto snap-x snap-mandatory rounded-t-3xl">
              {galleryImages.map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="w-full snap-center shrink-0 h-48 object-cover" />
              ))}
            </div>
          ) : (
            <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center rounded-t-3xl">
              <span className="text-5xl">🍽️</span>
            </div>
          )}
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              aria-label={item.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
              title={item.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
              className="absolute top-3 right-14 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow"
            >
              <Heart
                size={16}
                className={item.isFavorite ? 'text-red-500' : 'text-slate-400'}
                fill={item.isFavorite ? 'currentColor' : 'none'}
              />
            </button>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <ClusterFoodGradeDot grade={item.foodGrade} />
              <h3 className="text-base font-bold text-slate-900">{item.name}</h3>
              <span className="text-[10px] text-slate-400">· {outlet.name}</span>
            </div>
            {(item.longDescription || item.shortDescription || item.description) && (
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {item.longDescription || item.shortDescription || item.description}
              </p>
            )}
            {item.preparationTime && (
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <Clock size={10} /> {item.preparationTime} min
              </p>
            )}
          </div>

          {item.variants?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Choose size</p>
              <div className="space-y-1.5">
                {item.variants.map((v: any) => {
                  const checked = variantId === v.id;
                  return (
                    <label key={v.id} className={
                      'flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer '
                      + (checked ? 'border-brand-300 bg-brand-50/40' : 'border-slate-100')
                    }>
                      <span className="flex items-center gap-2">
                        <input type="radio" name="variant" checked={checked} onChange={() => setVariantId(v.id)} className="accent-brand-500" />
                        <span className="text-sm font-semibold text-slate-800">{v.name}</span>
                      </span>
                      <span className="text-sm font-bold text-slate-900">₹{Number(v.price).toFixed(0)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {item.itemToppings?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Toppings</p>
              <div className="space-y-2">
                {item.itemToppings.map((link: any) => {
                  const sel = topSel[link.toppingId] || { selected: false };
                  const linkAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping?.basePriceAdd ?? 0);
                  const hasOptions = link.topping?.options?.length > 0;
                  return (
                    <div key={link.toppingId} className="bg-slate-50 rounded-xl p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={link.isRequired}
                          checked={sel.selected}
                          onChange={(e) => setTopSel((p) => ({ ...p, [link.toppingId]: { selected: e.target.checked, optionId: p[link.toppingId]?.optionId } }))}
                          className="w-4 h-4 accent-brand-500"
                        />
                        <span className="text-sm font-semibold text-slate-800 flex-1">
                          {link.topping?.name}
                          {link.isRequired && <span className="ml-1 text-[10px] text-red-500">required</span>}
                        </span>
                        {!hasOptions && <span className="text-xs font-bold text-slate-700">+₹{linkAdd.toFixed(0)}</span>}
                      </label>
                      {hasOptions && sel.selected && (
                        <div className="mt-2 ml-6 space-y-1.5">
                          {link.topping.options.map((opt: any) => (
                            <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`top-${link.toppingId}`}
                                checked={sel.optionId === opt.id}
                                onChange={() => setTopSel((p) => ({ ...p, [link.toppingId]: { selected: true, optionId: opt.id } }))}
                                className="accent-brand-500"
                              />
                              <span className="text-xs text-slate-700 flex-1">{opt.name}</span>
                              <span className="text-[11px] font-semibold text-slate-700">+₹{(linkAdd + Number(opt.priceAdd)).toFixed(0)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
            <p className="text-sm font-semibold text-slate-700">Quantity</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><Minus size={14} /></button>
              <span className="w-6 text-center font-bold text-sm">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="w-8 h-8 bg-brand-500 text-white rounded-lg flex items-center justify-center"><Plus size={14} /></button>
            </div>
          </div>
        </div>

        {/* Sticky footer CTA — always visible regardless of scroll position */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-base font-bold text-slate-900">₹{lineTotal.toFixed(0)}</span>
          <button
            onClick={() => {
              const cartLineId = makeClusterLineId(outlet.id, item.id, variant?.id, toppings);
              const line: ClusterCartLine = {
                cartLineId,
                outletId: outlet.id,
                outletName: outlet.name,
                itemId: item.id,
                itemName: item.name,
                variantId: variant?.id ?? null,
                variantName: variant?.name ?? null,
                unitPrice,
                quantity: 0,
                toppings: toppings.length ? toppings : undefined,
              };
              onAdded(qty, line);
            }}
            disabled={!item.isAvailable}
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-2xl text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add {qty} to cart · ₹{lineTotal.toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  );
}
