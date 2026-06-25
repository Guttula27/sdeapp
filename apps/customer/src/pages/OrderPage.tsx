import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ShoppingCart, Plus, Minus, X, LogOut, Star, Clock, ChevronRight, User, Heart, Lock } from 'lucide-react';
import api from '../services/api';
import { cachedGet } from '../utils/cachedGet';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useCustomerAuth } from '../context/CustomerAuthContext';

interface CartTopping {
  toppingId: string;
  optionId?: string;
  label: string;     // human-readable: "Cheese" or "Spicy: Medium"
  priceAdd: number;
}

interface CartItem {
  itemId: string; variantId?: string;
  name: string;   variantName?: string;
  price: number;  quantity: number;
  toppings?: CartTopping[];
  // Customer-choice bundle picks (ItemBundleChild ids) when the bundle has
  // maxBundleSelections set. The server expands only these rows at order
  // time. Stored on the cart line so we can replay the picker label and
  // ship the same picks on each order POST.
  bundleSelections?: string[];
  bundleSelectionLabels?: string[];
  // unique per (item+variant+toppings+bundleSelections) — bundles are
  // just items where the server expands children at order time. Including
  // selections in the key lets the same bundle appear multiple times with
  // different picks (e.g. "Thali · idly+coffee" vs "Thali · dosa+tea").
  cartLineId: string;
}

// Format a nextOpen hint (server-stamped { dayOfWeek 1..7, minute 0..1439 })
// into a short label like "9:00 AM" (today), "Tomorrow 9:00 AM", or
// "Mon 9:00 AM" (further out). Used to populate the "Available from …"
// badge on items / categories / subs whose schedule has them blocked.
const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function formatNextOpen(
  next: { dayOfWeek: number; minute: number } | null | undefined,
  fallback = 'soon',
): string {
  if (!next) return fallback;
  const h = Math.floor(next.minute / 60);
  const m = next.minute % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const time = `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  const now = new Date();
  const todayDow = now.getDay() === 0 ? 7 : now.getDay(); // ISO Mon=1..Sun=7
  if (next.dayOfWeek === todayDow) return time;
  const tomorrow = (todayDow % 7) + 1;
  if (next.dayOfWeek === tomorrow) return `Tomorrow ${time}`;
  return `${DAY_LABELS[next.dayOfWeek]} ${time}`;
}

export default function OrderPage() {
  const [params, setParams] = useSearchParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const outletId  = params.get('outlet') || '';
  const tableId   = params.get('table');
  // QR codes for individual items deeplink here with ?item=<id>. We pop the
  // matching item's detail modal once the menu has loaded, then strip the
  // param so the modal doesn't reopen on back-nav. `location.key` is in
  // the effect deps so even a re-scan of a different item from this same
  // outlet (which keeps us on /order without remounting) re-fires the
  // pop. Without that key, only the deeplink-id-derived value drove the
  // effect and certain navigations skipped the pop.
  const deeplinkItemId = params.get('item');
  const { user, isLoggedIn } = useCustomerAuth();

  const [menu, setMenu]           = useState<any[]>([]);
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [openStatus, setOpenStatus] = useState<{ isOpen: boolean; reason: string | null } | null>(null);
  // Outlet meta drives whether we route to /pay (prepaid) or use the open-tab
  // postpaid flow inline. Loaded once on mount.
  const [outletMeta, setOutletMeta] = useState<{
    outletType?: string;
    outletName?: string;
    outletLogoUrl?: string | null;
    businessName?: string | null;
    businessLogoUrl?: string | null;
    parcelChargeEnabled?: boolean;
    defaultParcelCharge?: number;
  } | null>(null);
  // The open postpaid order on this table — items already submitted, locked
  // from edits, waiting for Bill Now.
  const [openOrder, setOpenOrder] = useState<any | null>(null);
  const [cart, setCart]           = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(`cart-${outletId || ''}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showCart, setShowCart]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const [placing, setPlacing]     = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [activeSub, setActiveSub] = useState('');
  const [detailItem, setDetailItem] = useState<any>(null);

  // Wire the half-screen item detail + cart sheet into the browser
  // history so the mobile back button just closes them instead of
  // navigating off /order (which on a scan-in flow drops the
  // customer all the way back to the QR scan screen). Push a marker
  // state on open, pop it on close — same pattern most native apps
  // use for transient sheets.
  useEffect(() => {
    if (!detailItem) return;
    const marker = { modal: 'item-detail' as const };
    window.history.pushState(marker, '');
    const onPopState = () => setDetailItem(null);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      // If the modal closed by other means (X button, Add to cart),
      // the synthetic entry we pushed is still on the stack. Pop it
      // so the next back-press doesn't leave the user re-opening a
      // closed modal.
      if (window.history.state && (window.history.state as any).modal === 'item-detail') {
        window.history.back();
      }
    };
  }, [!!detailItem]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showCart) return;
    const marker = { modal: 'cart' as const };
    window.history.pushState(marker, '');
    const onPopState = () => setShowCart(false);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (window.history.state && (window.history.state as any).modal === 'cart') {
        window.history.back();
      }
    };
  }, [showCart]);

  // Menu tabs (multi-menu feature). Populated only when the outlet's business
  // has multipleMenusEnabled (otherwise the single Main Menu stays implicit and
  // tabs are hidden). enabledMenus filters out menus the outlet has disabled.
  const [enabledMenus, setEnabledMenus] = useState<Array<{ id: string; name: string }>>([]);
  const [activeMenuId, setActiveMenuId] = useState<string>('');
  // Stale-read indicator — true when the menu we're rendering came from
  // the localStorage cache rather than a fresh network fetch.
  const [menuFromCache, setMenuFromCache] = useState(false);
  const [menuCachedAt, setMenuCachedAt] = useState<number | null>(null);

  /**
   * Opens the detail/picker modal. The list response is slim — toppings,
   * bundleChildren, gallery images, and pricing-override rows are stripped
   * so the first paint is small. This wrapper shows the modal immediately
   * with the slim data (basic fields render fine) and fans out a fetch for
   * the full item in parallel. When the fetch lands, both the modal item
   * and the in-memory menu tree are patched so a re-open is instant.
   *
   * Gracefully degrades on fetch failure: the modal still shows what it
   * has; the user can close without seeing toppings if the network is down.
   */
  const openDetail = async (item: any) => {
    setDetailItem(item);
    // Already hydrated (e.g. user re-opened the same item) → skip.
    if (item.itemToppings !== undefined && item.bundleChildren !== undefined) return;
    try {
      const { data } = await api.get(`/outlets/${outletId}/menu/items/${item.id}`, {
        params: tableId ? { tableId } : undefined,
      });
      const full = data?.data;
      if (!full) return;
      setDetailItem((curr: any) => (curr && curr.id === full.id ? full : curr));
      setMenu((prev: any[]) =>
        prev.map((cat) => ({
          ...cat,
          subcategories: (cat.subcategories || []).map((s: any) => ({
            ...s,
            items: (s.items || []).map((i: any) => (i.id === full.id ? { ...i, ...full } : i)),
          })),
        })),
      );
    } catch {
      /* swallow — modal already showed with slim data */
    }
  };

  // Optimistic favorite toggle on the menu list
  const toggleFavorite = async (item: any) => {
    if (!isLoggedIn) {
      toast('Sign in to save favourites', { icon: '🔐' });
      return;
    }
    const next = !item.isFavorite;
    // Optimistic update
    setMenu(prev => prev.map(c => ({
      ...c,
      subcategories: c.subcategories?.map((s: any) => ({
        ...s,
        items: s.items?.map((it: any) => it.id === item.id ? { ...it, isFavorite: next } : it),
      })),
    })));
    try {
      if (next) await api.post(`/users/me/favorites/${item.id}`);
      else      await api.delete(`/users/me/favorites/${item.id}`);
    } catch {
      // Revert on failure
      setMenu(prev => prev.map(c => ({
        ...c,
        subcategories: c.subcategories?.map((s: any) => ({
          ...s,
          items: s.items?.map((it: any) => it.id === item.id ? { ...it, isFavorite: !next } : it),
        })),
      })));
      toast.error('Failed to update favourite');
    }
  };

  // Cluster-aware redirect. When this outlet is currently a member of a
  // cluster, every standalone QR for it must route into the cluster shell
  // (outlets are cluster-exclusive while linked). We do this BEFORE the
  // menu fetch so the user never sees a flash of the standalone menu.
  useEffect(() => {
    let cancelled = false;
    if (!outletId) return;
    api.get(`/outlets/${outletId}/open-status`).then((r) => {
      if (cancelled) return;
      const cm = r.data?.data?.clusterMembership;
      if (cm?.clusterPublicCode) {
        const qs = new URLSearchParams({
          outletId,
          ...(tableId ? { tableId } : {}),
        });
        navigate(`/cluster/${cm.clusterPublicCode}?${qs.toString()}`, { replace: true });
      }
    }).catch(() => { /* silent — fall through to the main load below */ });
    return () => { cancelled = true; };
  }, [outletId, tableId]);

  useEffect(() => {
    // Menu fetch goes through cachedGet so a network blip can fall back
    // to the last successful read. The other two fetches (open-status,
    // menus list) are direct since they're cheap and degrade gracefully.
    // slim=true asks the server for a trimmed list payload (no toppings/
    // bundleChildren/gallery/pricing-override rows). The detail/picker
    // modal lazy-loads the full item from /menu/items/:itemId on open.
    // The `-slim` suffix on the cache key keeps any legacy non-slim
    // localStorage entries from being served as slim-shape after rollout.
    const menuKey = `outlet-menu-slim:${outletId}:${tableId || ''}`;
    Promise.all([
      cachedGet<any[]>(menuKey, `/outlets/${outletId}/menu`, {
        params: { slim: 'true', ...(tableId ? { tableId } : {}) },
      }),
      api.get(`/outlets/${outletId}/open-status`).catch(() => null),
      api.get(`/outlets/${outletId}/menus`, { params: tableId ? { tableId } : {} }).catch(() => null),
      api.get(`/outlets/${outletId}/offers/active`).catch(() => null),
    ])
      .then(([menuResult, statusRes, menusRes, offersRes]) => {
        const menuData = menuResult.data;
        setActiveOffers(offersRes?.data?.data || offersRes?.data || []);
        // Bundles are now first-class Items (Item.isBundle=true) and appear
        // naturally inside their own subcategory on the menu tree — no
        // synthetic category injection needed.
        setMenu(menuData);
        setMenuFromCache(menuResult.fromCache);
        setMenuCachedAt(menuResult.cachedAt);
        if (statusRes) {
          setOpenStatus(statusRes.data.data);
          // open-status carries outletType (gates postpaid flow) plus the
          // outlet+business name/logo for the sticky brand header. No
          // separate /outlets/:id call needed.
          const d = statusRes.data.data || {};
          if (d.outletType || d.outletName) {
            setOutletMeta({
              outletType: d.outletType,
              outletName: d.outletName,
              outletLogoUrl: d.outletLogoUrl,
              businessName: d.businessName,
              businessLogoUrl: d.businessLogoUrl,
              parcelChargeEnabled: !!d.parcelChargeEnabled,
              defaultParcelCharge: Number(d.defaultParcelCharge ?? 0),
            });
          }
        }
        // Build the menu-tab list. Filter to enabled menus that actually
        // have visible categories in this outlet's menu payload so a stale
        // menu with no items doesn't surface an empty tab.
        const categoryMenuIds = new Set<string>(
          (menuData || []).map((c: any) => c.menuId).filter(Boolean),
        );
        const menus: Array<{ id: string; name: string; isEnabled: boolean }> = (menusRes?.data?.data || []).map((m: any) => ({
          id: m.id, name: m.name, isEnabled: m.outletMenu?.isEnabled !== false,
        }));
        const usable = menus.filter((m) => m.isEnabled && categoryMenuIds.has(m.id));
        setEnabledMenus(usable);

        // Seed the active menu + category. Prefer the first menu's first
        // category so the UI lands in a coherent state.
        const initialMenuId = usable[0]?.id || '';
        setActiveMenuId(initialMenuId);
        const firstCat = (menuData || []).find((c: any) => !initialMenuId || c.menuId === initialMenuId)
                       || menuData?.[0];
        if (firstCat) {
          setActiveCategory(firstCat.id);
          setActiveSub(firstCat.subcategories?.[0]?.id || '');
        }
      })
      .finally(() => setLoading(false));
  }, [outletId]);

  // When the active menu changes, snap to its first category so the user
  // doesn't see an empty list (previous category may belong to a different menu).
  useEffect(() => {
    if (!activeMenuId) return;
    const cats = menu.filter((c: any) => c.menuId === activeMenuId);
    if (!cats.find((c: any) => c.id === activeCategory)) {
      const first = cats[0];
      if (first) {
        setActiveCategory(first.id);
        setActiveSub(first.subcategories?.[0]?.id || '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenuId]);

  // Refresh-on-focus — re-fetch the menu when the tab regains focus so
  // admin updates (item availability, price changes, stock decrement)
  // propagate to a long-open tab. Lightweight: only re-pulls the menu
  // payload, not the heavier orchestration in the initial useEffect.
  useRefreshOnFocus(async () => {
    if (!outletId) return;
    try {
      const menuKey = `outlet-menu-slim:${outletId}:${tableId || ''}`;
      const [result, statusRes] = await Promise.all([
        cachedGet<any[]>(menuKey, `/outlets/${outletId}/menu`, {
          params: { slim: 'true', ...(tableId ? { tableId } : {}) },
        }),
        // Open-status must NOT be cached — if the outlet opened at 9
        // and the customer returns at 9:35, the stale "closed" from
        // an earlier visit would block ordering. Bypass any SW cache.
        api.get(`/outlets/${outletId}/open-status`, {
          headers: { 'Cache-Control': 'no-cache' },
        }).catch(() => null),
      ]);
      if (!result.fromCache) {
        setMenu(result.data);
        setMenuFromCache(false);
        setMenuCachedAt(result.cachedAt);
      } else if (!menuFromCache) {
        setMenuFromCache(true);
        setMenuCachedAt(result.cachedAt);
      }
      if (statusRes?.data?.data) {
        setOpenStatus(statusRes.data.data);
      }
    } catch { /* silent — banner remains in its current state */ }
  });

  // Postpaid open-tab flow only applies when the customer scanned a table
  // QR on a Dine-in Postpaid outlet. Anything else (counter, parcel, dine-in
  // prepaid, hybrid) keeps the existing prepaid checkout via /pay.
  const isPostpaidTable = !!tableId && outletMeta?.outletType === 'DINE_IN_POSTPAID';

  const refreshOpenOrder = async () => {
    if (!isPostpaidTable || !isLoggedIn) { setOpenOrder(null); return; }
    try {
      const { data } = await api.get(`/outlets/${outletId}/orders/open`, { params: { tableId } });
      setOpenOrder(data.data ?? null);
    } catch {
      setOpenOrder(null);
    }
  };
  useEffect(() => { refreshOpenOrder(); }, [isPostpaidTable, isLoggedIn, outletId, tableId]);

  // When category changes, snap to first subcategory
  useEffect(() => {
    const cat = menu.find(c => c.id === activeCategory);
    if (cat?.subcategories?.length) setActiveSub(cat.subcategories[0].id);
  }, [activeCategory, menu]);

  // Item QR deeplink: once the menu has loaded, find the requested item
  // and pop the detail sheet. Then drop the param so a back-nav or sheet
  // close doesn't re-open it. Depends on location.key so a re-scan of a
  // different item from the same outlet (which doesn't remount the
  // component) re-fires the pop reliably — that's the bug the user
  // hit: cart has items → scan another QR → "nothing happens" because
  // setParams from a prior pop had already stripped item and the
  // effect didn't re-evaluate on the next URL change.
  useEffect(() => {
    if (!deeplinkItemId || !menu.length) return;
    for (const cat of menu) {
      for (const sub of cat.subcategories || []) {
        const found = (sub.items || []).find((i: any) => i.id === deeplinkItemId);
        if (found) {
          void openDetail(found);
          const next = new URLSearchParams(params);
          next.delete('item');
          setParams(next, { replace: true });
          return;
        }
      }
    }
  }, [deeplinkItemId, menu, location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist cart across navigation (Pay page → back)
  useEffect(() => {
    try { sessionStorage.setItem(`cart-${outletId || ''}`, JSON.stringify(cart)); } catch {}
  }, [cart, outletId]);

  // Topping picker state
  const [toppingPicker, setToppingPicker] = useState<{ item: any; variant?: any } | null>(null);
  const [pickerSelections, setPickerSelections] = useState<Record<string, { optionId?: string; selected: boolean }>>({});

  const cartKey = (l: CartItem) => l.cartLineId;
  const makeLineId = (
    itemId: string,
    variantId: string | undefined,
    toppings: CartTopping[],
    bundleSelections?: string[],
  ) =>
    `${itemId}-${variantId || ''}` +
    `-${toppings.map(t => `${t.toppingId}:${t.optionId || ''}`).sort().join('|')}` +
    (bundleSelections?.length ? `-b:${[...bundleSelections].sort().join(',')}` : '');

  const addToCart = (
    item: any,
    variant?: any,
    toppings: CartTopping[] = [],
    bundlePicks?: { selections: string[]; labels: string[] },
  ) => {
    const basePrice = variant
      ? Number(variant.effectivePrice ?? variant.price)
      : Number(item.effectivePrice ?? item.basePrice);
    const toppingTotal = toppings.reduce((s, t) => s + t.priceAdd, 0);
    const cartLineId = makeLineId(item.id, variant?.id, toppings, bundlePicks?.selections);
    setCart((prev) => {
      const hit = prev.find((c) => c.cartLineId === cartLineId);
      if (hit) return prev.map((c) => c.cartLineId === cartLineId ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, {
        cartLineId,
        itemId: item.id, variantId: variant?.id,
        name: item.name, variantName: variant?.name,
        price: basePrice + toppingTotal,
        quantity: 1,
        toppings: toppings.length ? toppings : undefined,
        bundleSelections: bundlePicks?.selections,
        bundleSelectionLabels: bundlePicks?.labels,
      }];
    });
  };

  const tryAddToCart = (item: any, variant?: any) => {
    // Customer-choice bundle: detail modal owns the picker (it already shows
    // variants/qty), so route quick-add through there instead of building a
    // parallel picker.
    if (item.isBundle && item.maxBundleSelections && Number(item.maxBundleSelections) > 0) {
      setDetailItem(item);
      return;
    }
    if (item.itemToppings?.length) {
      // Open picker; initialize each radio topping to its first option
      const init: Record<string, { optionId?: string; selected: boolean }> = {};
      item.itemToppings.forEach((l: any) => {
        if (l.topping.options.length) {
          init[l.toppingId] = {
            optionId: l.isRequired ? l.topping.options[0].id : undefined,
            selected: !!l.isRequired,
          };
        } else {
          init[l.toppingId] = { selected: !!l.isRequired };
        }
      });
      setPickerSelections(init);
      setToppingPicker({ item, variant });
    } else {
      addToCart(item, variant);
    }
  };

  const confirmPicker = () => {
    if (!toppingPicker) return;
    const { item, variant } = toppingPicker;
    const toppings: CartTopping[] = [];
    for (const link of item.itemToppings || []) {
      const sel = pickerSelections[link.toppingId];
      if (!sel?.selected && !link.isRequired) continue;
      const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
      if (link.topping.options.length) {
        const optId = sel?.optionId || link.topping.options[0].id;
        const opt = link.topping.options.find((o: any) => o.id === optId);
        if (!opt) continue;
        toppings.push({
          toppingId: link.toppingId,
          optionId: opt.id,
          label: `${link.topping.name}: ${opt.name}`,
          priceAdd: basePriceAdd + Number(opt.priceAdd),
        });
      } else {
        toppings.push({
          toppingId: link.toppingId,
          label: link.topping.name,
          priceAdd: basePriceAdd,
        });
      }
    }
    addToCart(item, variant, toppings);
    setToppingPicker(null);
    setPickerSelections({});
  };

  const updateQty = (lineId: string, delta: number) =>
    setCart((prev) =>
      prev.map((c) => c.cartLineId === lineId ? { ...c, quantity: c.quantity + delta } : c)
          .filter((c) => c.quantity > 0)
    );

  const [isParcel, setIsParcel] = useState(false);

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  // Estimate per-line GST from the menu (server recomputes authoritatively).
  const taxAmount = cart.reduce((s, c) => {
    let rate = 0;
    for (const cat of menu) for (const sub of cat.subcategories || []) for (const it of sub.items || []) {
      if (it.id === c.itemId && it.gstRate != null) rate = Number(it.gstRate);
    }
    return s + c.price * c.quantity * (rate / 100);
  }, 0);
  // Parcel charge preview. Mirrors OrdersService.computeParcelCharge so
  // the cart total matches the server's authoritative calc:
  //   - Any item with its own override (useCustomParcelCharge + parcelCharge)
  //     contributes parcelCharge × qty AND replaces the outlet flat for
  //     the whole order. Items without their own override contribute 0.
  //   - Otherwise outlet.defaultParcelCharge once (flat).
  //   - Otherwise 0.
  const parcelPreview = (() => {
    if (!isParcel) return 0;
    let itemOverrideTotal = 0;
    let anyOverride = false;
    for (const c of cart) {
      let it: any = null;
      for (const cat of menu) for (const sub of cat.subcategories || []) for (const i of sub.items || []) {
        if (i.id === c.itemId) it = i;
      }
      if (it?.useCustomParcelCharge && it.parcelCharge != null) {
        itemOverrideTotal += Number(it.parcelCharge) * c.quantity;
        anyOverride = true;
      }
    }
    if (anyOverride) return itemOverrideTotal;
    if (outletMeta?.parcelChargeEnabled) return Number(outletMeta.defaultParcelCharge ?? 0);
    return 0;
  })();
  const cartTotal = subtotal + taxAmount + parcelPreview;
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const goToPay = () => {
    if (!cart.length) return;
    if (openStatus && !openStatus.isOpen) {
      toast.error(`Outlet is currently closed${openStatus.reason ? ` · ${openStatus.reason}` : ''}`);
      return;
    }
    if (!isLoggedIn) {
      toast('Sign in to continue', { icon: '🔐' });
      navigate('/auth', { state: { from: `/order${window.location.search}` } });
      return;
    }
    navigate('/pay', {
      state: {
        outletId,
        tableId,
        cart,
        isParcel,
        subtotal,
        taxAmount,
        parcelPreview,
        total: cartTotal,
      },
    });
  };

  // Postpaid: place items without payment; open tab keeps accepting more
  // items until the customer hits Bill Now (which routes to /pay).
  const placePostpaid = async () => {
    if (!cart.length) return;
    if (openStatus && !openStatus.isOpen) {
      toast.error(`Outlet is currently closed${openStatus.reason ? ` · ${openStatus.reason}` : ''}`);
      return;
    }
    if (!isLoggedIn) {
      toast('Sign in to continue', { icon: '🔐' });
      navigate('/auth', { state: { from: `/order${window.location.search}` } });
      return;
    }
    setPlacing(true);
    try {
      const itemsPayload = cart.map((c) => ({
        itemId: c.itemId,
        variantId: c.variantId,
        quantity: c.quantity,
        toppings: c.toppings?.map((t) => ({ toppingId: t.toppingId, optionId: t.optionId })) || undefined,
        bundleSelections: c.bundleSelections,
      }));
      if (openOrder) {
        await api.post(`/outlets/${outletId}/orders/${openOrder.id}/items`, { items: itemsPayload });
        toast.success('Items added to your tab');
      } else {
        await api.post(`/outlets/${outletId}/orders`, {
          tableId,
          isPostpaid: true,
          items: itemsPayload,
        });
        toast.success('Tab opened — keep ordering');
      }
      setCart([]);
      setShowCart(false);
      try { sessionStorage.removeItem(`cart-${outletId}`); } catch {}
      await refreshOpenOrder();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const goBillNow = () => {
    if (!openOrder) return;
    navigate('/pay', {
      state: {
        outletId,
        tableId,
        billOrderId: openOrder.id,
        total: Number(openOrder.totalAmount),
        outletName: openOrder.outlet?.name,
      },
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-dvh bg-white">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 font-medium">Loading menu…</p>
      </div>
    </div>
  );

  const activeCat = menu.find((c) => c.id === activeCategory);

  return (
    // h-full (fills the BottomNav <main> which is now the scroll
    // container) instead of h-dvh so the page can't extend past the
    // shell. The inner 3-pane flex container has its own
    // overflow-y-auto on the items pane so the rail + item list scroll
    // independently of each other and of the header/category strip.
    <div className="h-full bg-slate-50 flex flex-col overflow-hidden">
      {/* Cached-menu indicator — only shown when the menu came from the
          localStorage fallback (network unavailable or slow). Auto-
          clears on the next successful refresh. */}
      {menuFromCache && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2 text-[11px] text-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-bold">Cached menu</span>
          {menuCachedAt && (
            <span className="opacity-70">
              · last updated {Math.max(1, Math.round((Date.now() - menuCachedAt) / 60000))}m ago
            </span>
          )}
          <button
            onClick={() => window.location.reload()}
            className="ml-auto text-amber-900 font-bold underline underline-offset-2"
          >
            Refresh
          </button>
        </div>
      )}

      {/* ── Open tab banner (Dine-in Postpaid only) ─────────────── */}
      {isPostpaidTable && openOrder && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-30">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Your tab</p>
            <p className="text-xs text-emerald-900 truncate">
              {openOrder.items?.length || 0} item{(openOrder.items?.length || 0) === 1 ? '' : 's'} · ₹{Number(openOrder.totalAmount).toFixed(2)}
            </p>
          </div>
          <button
            onClick={goBillNow}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow"
          >
            Bill Now →
          </button>
        </div>
      )}
      {/* ── Sticky header ──────────────────────────────────────
          Brand-teal banner so the chrome reads consistently with the
          rest of the customer surface (the MENU strip and BottomNav
          accents share this language). Top bar's children get
          inverted text-color treatment for contrast; the menu /
          categories strips below have their own backgrounds and
          override the parent. */}
      <div className={clsx('bg-brand-700 sticky z-20 shadow-sm', isPostpaidTable && openOrder ? 'top-[52px]' : 'top-0')}>
        {/* Top bar */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => {
                if (cart.length > 0 && !window.confirm('Leave and clear cart?')) return;
                navigate('/');
              }}
              className="w-8 h-8 flex items-center justify-center text-brand-200 hover:text-white rounded-lg hover:bg-brand-600 shrink-0 transition-colors"
            >
              <LogOut size={17} />
            </button>
            {/* Outlet logo (or business logo as fallback) shown alongside the
                outlet name so the customer is anchored in the brand context.
                Falls back to a lighter-teal tile with the initial when no
                logo has been uploaded (the canonical brand-400 lifts well
                against the brand-700 banner). */}
            {(outletMeta?.outletLogoUrl || outletMeta?.businessLogoUrl) ? (
              <img
                src={outletMeta.outletLogoUrl || outletMeta.businessLogoUrl || ''}
                alt={outletMeta?.outletName || ''}
                className="w-9 h-9 rounded-xl object-cover shrink-0 ring-1 ring-white/20"
              />
            ) : outletMeta?.outletName ? (
              <div className="w-9 h-9 rounded-xl bg-brand-500 text-white font-black text-sm flex items-center justify-center shrink-0 ring-1 ring-white/20">
                {outletMeta.outletName.charAt(0).toUpperCase()}
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="font-bold text-white text-sm leading-tight truncate">
                {outletMeta?.outletName || 'Menu'}
              </p>
              <p className="text-[11px] text-brand-200 truncate">
                {outletMeta?.businessName && <span>{outletMeta.businessName}</span>}
                {outletMeta?.businessName && tableId && <span> · </span>}
                {tableId && <span>Table {tableId.replace('table-', 'T')}</span>}
              </p>
            </div>
          </div>

          {/* Right side: user avatar or login */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/profile')}
                className="w-8 h-8 bg-brand-500 hover:bg-brand-400 rounded-full flex items-center justify-center text-white font-black text-sm ring-1 ring-white/20 transition-colors"
                title={`Signed in as ${user?.name}`}
              >
                {user?.name?.[0]}
              </button>
            ) : (
              <button
                onClick={() => navigate('/auth', { state: { from: `/order${window.location.search}` } })}
                className="flex items-center gap-1 text-xs text-white bg-brand-600 hover:bg-brand-500 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <User size={12} /> Sign in
              </button>
            )}
            <button
              onClick={() => setShowCart(true)}
              // Gold-on-charcoal — per the tailwind config's design
              // intent (gold is the "money zone": Add to Cart, Place
              // Order, Pay). Charcoal text because gold + white fails
              // the contrast checker.
              className="relative flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-charcoal-900 px-4 py-2 rounded-full text-sm font-semibold shadow-sm transition-colors"
            >
              <ShoppingCart size={16} />
              Cart
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Menu tabs — primary navigation layer. When the outlet runs more
            than one menu we render a prominent pill bar so customers clearly
            see they're switching between top-level menus (Breakfast vs
            Desserts vs Drinks), with category tabs nested beneath. */}
        {enabledMenus.length > 1 && (
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2.5 border-b border-slate-700/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Menu</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {enabledMenus.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMenuId(m.id)}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap flex-shrink-0 transition-all',
                    activeMenuId === m.id
                      ? 'bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow-lg ring-1 ring-brand-300/50'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20',
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category tabs — nested beneath the active menu when multi-menu. */}
        {enabledMenus.length > 1 && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 pt-2 -mb-1">
            Categories
          </p>
        )}
        <div className="flex gap-2 px-4 pb-3 pt-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveCategory('__special__')}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all inline-flex items-center gap-1',
              activeCategory === '__special__'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
            )}
          >
            ⭐ Special
          </button>
          {menu
            .filter((cat) => !activeMenuId || cat.menuId === activeMenuId)
            .map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={clsx(
                'px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all',
                activeCategory === cat.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Outlet-closed banner ─────────────────────────────── */}
      {openStatus && !openStatus.isOpen && (
        <div className="bg-amber-50 border-y border-amber-200 px-4 py-2.5 flex items-center gap-2 text-amber-800">
          <Lock size={14} className="shrink-0" />
          <p className="text-xs font-semibold">
            Outlet is currently closed{openStatus.reason ? ` · ${openStatus.reason}` : ''}. You can browse the menu but ordering is disabled.
          </p>
        </div>
      )}

      {/* ── Active offers banner ─────────────────────────────── */}
      {activeOffers.length > 0 && (
        <div className="bg-gradient-to-r from-brand-50 to-amber-50 border-y border-brand-200 px-4 py-2 flex items-center gap-3 overflow-x-auto">
          {activeOffers.map((o: any) => (
            <div key={o.id} className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-800 bg-white/80 rounded-full px-2.5 py-1">
              🎁 {o.triggerType === 'MIN_BILL'
                ? `Spend ₹${o.minBillAmount} → get ${o.getItem?.name || 'free item'}`
                : `Buy ${o.buyQuantity}× ${o.buyItem?.name || 'item'} → ${o.getQuantity}× ${o.getItem?.name || 'item'} free`}
            </div>
          ))}
        </div>
      )}

      {/* ── Menu content (3-pane) ────────────────────────────── */}
      {/* No pb-24 here — the BottomNav is in-flow in the shell now,
          not fixed, so we don't need to reserve space for it. */}
      <div className="flex-1 flex min-h-0">
        {activeCategory === '__special__' ? (
          <main className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-w-0">
            {(() => {
              const specialItems = menu
                .flatMap((c: any) => c.subcategories?.flatMap((s: any) => s.items || []) || [])
                .filter((i: any) => i.isDisplayed && i.isSpecial);
              if (specialItems.length === 0) {
                return <p className="text-sm text-slate-400 italic text-center py-12">No specials right now</p>;
              }
              const outletClosed = openStatus && !openStatus.isOpen;
              return specialItems.map((item: any) => {
                const outOfSchedule = item.inSchedule === false;
                const rowDisabled = outletClosed || !item.isAvailable || outOfSchedule;
                const rowReason = outletClosed
                  ? 'Outlet closed'
                  : !item.isAvailable
                    ? 'Currently not available'
                    : outOfSchedule
                      ? `Available ${formatNextOpen(item.nextOpen, 'later')}`
                      : null;
                return (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  qty={cart.filter(c => c.itemId === item.id).reduce((s, l) => s + l.quantity, 0)}
                  disabled={rowDisabled}
                  disabledReason={rowReason}
                  onOpen={() => void openDetail(item)}
                  onQuickAdd={(e) => {
                    e.stopPropagation();
                    // Open the detail modal whenever the item has anything
                    // configurable — variants, toppings, or a customer-choice
                    // bundle. Without the toppings clause, the +Add button
                    // silently dropped toppings on no-variant items, leaving
                    // every add stacking into a single un-customised line.
                    // Slim list payload exposes itemToppingsCount instead of
                    // the full itemToppings array.
                    const needsPicker = item.variants?.length
                      || (item.itemToppingsCount ?? 0) > 0
                      || (item.isBundle && Number(item.maxBundleSelections) > 0);
                    if (needsPicker) {
                      void openDetail(item);
                    } else {
                      addToCart(item);
                      toast.success(`Added ${item.name}`);
                    }
                  }}
                  onToggleFavorite={(e) => { e.stopPropagation(); toggleFavorite(item); }}
                />
                );
              });
            })()}
          </main>
        ) : (
        <>
        {/* Left: subcategories with thumbnail */}
        <aside className="w-24 sm:w-28 bg-white border-r border-slate-100 overflow-y-auto shrink-0">
          {activeCat?.subcategories?.map((sub: any) => {
            const thumb = sub.imageUrl
              || sub.items?.find((i: any) => i.thumbnailUrl || i.imageUrl)?.thumbnailUrl
              || sub.items?.find((i: any) => i.thumbnailUrl || i.imageUrl)?.imageUrl;
            const active = activeSub === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSub(sub.id)}
                className={clsx(
                  // Subcategory rail's "this is selected" stripe →
                  // gold. The selection IS a navigation marker, not
                  // an action, but a hint of gold here ties the rail
                  // visually to the gold CTAs in the same column.
                  'flex flex-col items-center w-full px-2 py-3 gap-1.5 border-l-[3px] transition-all',
                  active
                    ? 'border-gold-500 bg-gold-50/50'
                    : 'border-transparent hover:bg-slate-50',
                )}
              >
                <div className={clsx(
                  'w-14 h-14 rounded-xl overflow-hidden border shrink-0',
                  active ? 'border-gold-300 ring-2 ring-gold-100' : 'border-slate-200',
                )}>
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-base">
                      🍽️
                    </div>
                  )}
                </div>
                <span className={clsx(
                  'text-[11px] font-semibold leading-tight text-center line-clamp-2',
                  active ? 'text-brand-700' : 'text-slate-600',
                )}>
                  {sub.name}
                </span>
              </button>
            );
          })}
          {!activeCat?.subcategories?.length && (
            <p className="px-3 py-3 text-[11px] text-slate-400 italic">
              Currently there are no items available
            </p>
          )}
        </aside>

        {/* Right: items in selected subcategory */}
        <main className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-w-0">
          {(() => {
            const sub = activeCat?.subcategories?.find((s: any) => s.id === activeSub);
            const items = (sub?.items || []).filter((i: any) => i.isDisplayed);
            if (items.length === 0) {
              return (
                <p className="text-sm text-slate-400 italic text-center py-12">
                  Currently there are no items available
                </p>
              );
            }
            const outletClosed = openStatus && !openStatus.isOpen;
            return items.map((item: any) => {
              const outOfSchedule = item.inSchedule === false;
              const rowDisabled = outletClosed || !item.isAvailable || outOfSchedule;
              const rowReason = outletClosed
                ? 'Outlet closed'
                : !item.isAvailable
                  ? 'Currently not available'
                  : outOfSchedule
                    ? `Available ${formatNextOpen(item.nextOpen, 'later')}`
                    : null;
              return (
              <MenuItemRow
                key={item.id}
                item={item}
                qty={cart.filter(c => c.itemId === item.id).reduce((s, l) => s + l.quantity, 0)}
                disabled={rowDisabled}
                disabledReason={rowReason}
                onOpen={() => void openDetail(item)}
                onQuickAdd={(e) => {
                  e.stopPropagation();
                  const needsPicker = item.variants?.length
                    || (item.isBundle && Number(item.maxBundleSelections) > 0);
                  if (needsPicker) {
                    void openDetail(item);
                  } else {
                    addToCart(item);
                    toast.success(`Added ${item.name}`);
                  }
                }}
                onToggleFavorite={(e) => { e.stopPropagation(); toggleFavorite(item); }}
              />
              );
            });
          })()}
        </main>
        </>
        )}
      </div>

      {/* ── Floating cart button ─────────────────────────────── */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-24 inset-x-4 z-40 max-w-[440px] mx-auto">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-gradient-to-r from-brand-500 to-brand-400 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center px-5"
          >
            <span className="bg-white/20 rounded-xl w-7 h-7 flex items-center justify-center text-sm font-black mr-3">
              {cartCount}
            </span>
            <span className="flex-1 text-left">View Cart</span>
            <span className="font-black text-lg">₹{cartTotal.toFixed(2)}</span>
            <ChevronRight size={18} className="ml-1" />
          </button>
        </div>
      )}

      {/* ── Cart sheet ───────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-t-3xl shadow-sheet max-h-[80dvh] flex flex-col animate-[slideUp_.25s_ease-out]"
            style={{ animation: 'slideUp .25s ease-out' }}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-bold text-slate-900">Your Order</p>
                <p className="text-xs text-slate-400 mt-0.5">{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl">
                <X size={16} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {isPostpaidTable && openOrder?.items?.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lock size={11} className="text-slate-400" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Already on tab</p>
                  </div>
                  {openOrder.items.map((oi: any) => (
                    <div key={oi.id} className="flex items-center justify-between">
                      <p className="text-xs text-slate-700 truncate">
                        {oi.item?.name}{oi.variant?.name ? ` · ${oi.variant.name}` : ''}
                        <span className="text-slate-400"> × {oi.quantity}</span>
                      </p>
                      <p className="text-xs font-bold text-slate-600">₹{Number(oi.totalPrice).toFixed(2)}</p>
                    </div>
                  ))}
                  {cart.length > 0 && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pt-2 border-t border-slate-200">New items</p>
                  )}
                </div>
              )}
              {cart.map((item) => (
                <div key={item.cartLineId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    {item.variantName && <p className="text-xs text-slate-400">{item.variantName}</p>}
                    {item.toppings?.length && (
                      <p className="text-[11px] text-indigo-600 mt-0.5">+ {item.toppings.map(t => t.label).join(', ')}</p>
                    )}
                    {item.bundleSelectionLabels?.length && (
                      <p className="text-[11px] text-brand-800 mt-0.5">
                        {item.bundleSelections?.length ? 'Picks' : 'Includes'}: {item.bundleSelectionLabels.join(', ')}
                      </p>
                    )}
                    <p className="text-sm font-bold text-brand-600 mt-0.5">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQty(item.cartLineId, -1)} className="w-8 h-8 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors">
                      <Minus size={13} />
                    </button>
                    <span className="w-5 text-center font-bold text-sm text-slate-900">{item.quantity}</span>
                    <button onClick={() => updateQty(item.cartLineId, 1)} className="w-8 h-8 bg-brand-500 text-white rounded-xl flex items-center justify-center hover:bg-brand-600 transition-colors">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + CTA */}
            <div className="px-5 pt-4 pb-6 border-t border-slate-100 space-y-3 safe-bottom">
              <label className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={isParcel} onChange={e => setIsParcel(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                <span className="text-sm font-medium text-slate-700">Order for parcel / takeaway</span>
              </label>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>SGST <span className="text-[10px] text-slate-400">est.</span></span>
                      <span>₹{(taxAmount / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>CGST <span className="text-[10px] text-slate-400">est.</span></span>
                      <span>₹{(taxAmount / 2).toFixed(2)}</span>
                    </div>
                  </>
                )}
                {isParcel && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Parcel charges<span className="text-[10px] text-slate-400 ml-1">est.</span></span>
                    <span>₹{parcelPreview.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 text-lg pt-1 border-t border-slate-100">
                  <span>Total</span><span>₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={isPostpaidTable ? placePostpaid : goToPay}
                disabled={placing || (!!openStatus && !openStatus.isOpen)}
                // Place / pay → gold. Same "money zone" rule as
                // the header Cart button. Gold gradient for depth.
                className="w-full bg-gradient-to-r from-gold-500 to-gold-400 text-charcoal-900 font-bold py-4 rounded-2xl text-base shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[.98]"
              >
                {openStatus && !openStatus.isOpen
                  ? 'Outlet closed'
                  : isPostpaidTable
                    ? (openOrder ? 'Add to my tab →' : 'Place order →')
                    : 'Pay & place order →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item detail bottom-sheet (half-screen) */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onToggleFavorite={async () => {
            await toggleFavorite(detailItem);
            // Reflect the new state inside the open sheet so the heart fills
            // immediately. toggleFavorite already updates the menu list
            // optimistically; we mirror that single field on the open item.
            setDetailItem((it: any) => (it ? { ...it, isFavorite: !it.isFavorite } : it));
          }}
          onAdd={(picks, toppings, bundlePicks) => {
            // Each pick = (variant?, qty). Same toppings + bundle
            // picks apply to every entry.
            for (const pick of picks) {
              for (let i = 0; i < pick.qty; i++) {
                addToCart(detailItem, pick.variant, toppings, bundlePicks);
              }
            }
            setDetailItem(null);
            setShowCart(true);
          }}
        />
      )}
    </div>
  );
}

/* ── Compact menu row (right pane) ────────────────────────── */
const FOOD_GRADE_COLOR: Record<string, string> = { VEG: '#16a34a', NON_VEG: '#dc2626', VEGAN: '#0d9488' };
function FoodGradeDot({ grade }: { grade?: string }) {
  const color = FOOD_GRADE_COLOR[grade || 'VEG'];
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

function MenuItemRow({ item, qty, onOpen, onQuickAdd, onToggleFavorite, disabled, disabledReason }: {
  item: any; qty: number;
  onOpen: () => void;
  onQuickAdd: (e: React.MouseEvent) => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const hasVariants = !!item.variants?.length;
  // Resolve the lowest sticker price (`from ₹X`) the customer sees on
  // the row. For discount-aware display we also track the lowest
  // discounted price + matching savings so we can render strikethrough +
  // a "Save ₹Y" pill when an active line-level discount targets the item.
  const lowPrice = hasVariants
    ? Math.min(...item.variants.map((v: any) => Number(v.effectivePrice ?? v.price)))
    : Number(item.effectivePrice ?? item.basePrice);
  const lowDiscounted = hasVariants
    ? Math.min(
        ...item.variants.map((v: any) =>
          v.discountInfo?.discountedPrice != null
            ? Number(v.discountInfo.discountedPrice)
            : Number(v.effectivePrice ?? v.price),
        ),
      )
    : item.discountInfo?.discountedPrice != null
      ? Number(item.discountInfo.discountedPrice)
      : lowPrice;
  const hasDiscount = lowDiscounted < lowPrice - 0.005;
  const saveAmount = hasDiscount ? Math.round((lowPrice - lowDiscounted) * 100) / 100 : 0;
  return (
    <div
      onClick={disabled ? undefined : onOpen}
      role="button" tabIndex={disabled ? -1 : 0}
      className={clsx(
        'w-full text-left bg-white rounded-2xl border shadow-card overflow-hidden transition-colors',
        disabled
          ? 'border-slate-100 opacity-60 cursor-not-allowed'
          : 'border-slate-100 hover:border-brand-200 cursor-pointer',
      )}
    >
      {/* items-center so the (fixed-square) image vertically aligns
          with the text column's actual content, regardless of
          whether the name is one line or three. Without this, a
          short name left empty space below the 80px image while the
          rest of the text column floated next to the top of it. */}
      <div className="flex gap-3 p-3 items-center">
        {/* Image with the veg/non-veg/vegan badge overlaid on the
            top-right corner. Wrapped in a `relative` shell so the
            dot is positionally pinned regardless of the underlying
            element being an <img> or the placeholder gradient.
            White rounded tile around the dot for legibility against
            any photo background. */}
        <div className="relative shrink-0">
          {item.thumbnailUrl || item.imageUrl ? (
            <img src={item.thumbnailUrl || item.imageUrl} alt={item.name}
              loading="lazy" decoding="async"
              className={clsx('w-20 h-20 rounded-xl object-cover block', disabled && 'grayscale')} />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center">
              <span className="text-xl">🍽️</span>
            </div>
          )}
          <span className="absolute top-1 right-1 inline-flex items-center justify-center bg-white/95 rounded-md shadow-sm p-0.5">
            <FoodGradeDot grade={item.foodGrade} />
          </span>
        </div>
        {/* Tightened gap from 1.5 → 1 because the previous spacing
            looked OK only with multi-line names. For 1-line names it
            made the badge row float weirdly far below. */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* Row 1: name. Full width, no longer competing with the
              food-grade dot (which moved onto the image). */}
          <p className="text-sm font-bold text-slate-900 leading-tight line-clamp-3 min-w-0">{item.name}</p>
          {/* Row 2: badges. Full content-column width — no Add
              button squeezing it from the right, so the chip set can
              run across cleanly. */}
          {(onToggleFavorite || item.isPopular || item.isSpecial || hasVariants || (item.itemToppingsCount ?? item.itemToppings?.length ?? 0) > 0 || (item.hasLimitedStock && item.availableQuantity > 0) || (disabled && disabledReason)) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {onToggleFavorite && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
                  className={clsx(
                    // 32×32 hit target with an 18px icon — clears
                    // Material's recommended tap-target size.
                    'inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                    item.isFavorite ? 'bg-red-50 text-red-500' : 'text-slate-300 hover:text-red-400 hover:bg-red-50',
                  )}
                  title={item.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                  aria-label={item.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                >
                  <Heart size={18} fill={item.isFavorite ? 'currentColor' : 'none'} />
                </button>
              )}
              {item.isPopular && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">
                  <Star size={8} fill="currentColor" /> Popular
                </span>
              )}
              {item.isSpecial && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full">
                  ⭐ Special
                </span>
              )}
              {/* Variant count — single chip "Nx options" so the
                  customer knows tapping opens a chooser. */}
              {hasVariants && (
                <span className="inline-flex items-center text-[9px] font-bold bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full border border-brand-100">
                  {item.variants.length} options
                </span>
              )}
              {/* Toppings indicator. */}
              {(item.itemToppingsCount ?? item.itemToppings?.length ?? 0) > 0 && (
                <span className="inline-flex items-center text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full border border-indigo-100">
                  + toppings
                </span>
              )}
              {/* Limited-stock chip — exact count when ≤5 (mild
                  scarcity nudge), generic "Limited Quantity
                  Available" otherwise so we don't broadcast healthy
                  stock into FOMO. */}
              {item.hasLimitedStock && item.availableQuantity > 0 && (
                <span
                  className={clsx(
                    'inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                    item.availableQuantity <= 5
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-100',
                  )}
                  title={`Only ${item.availableQuantity} left in stock`}
                >
                  {item.availableQuantity <= 5
                    ? `Only ${item.availableQuantity} left`
                    : 'Limited Quantity Available'}
                </span>
              )}
              {disabled && disabledReason && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">
                  {disabledReason}
                </span>
              )}
            </div>
          )}
          {/* Row 3: short description, when present. */}
          {item.shortDescription && (
            <p className="text-[11px] text-slate-400 line-clamp-1">{item.shortDescription}</p>
          )}
          {/* Row 4: price + rating + prep time on the left, Add
              button on the right. justify-between splits them so the
              left stack hugs the start and the gold CTA hugs the
              end — the "split to the right" from the spec. */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {hasDiscount ? (
                <>
                  <span className="text-sm font-black text-emerald-700">
                    {hasVariants ? `from ₹${lowDiscounted.toFixed(0)}` : `₹${lowDiscounted.toFixed(0)}`}
                  </span>
                  <span className="text-xs text-slate-400 line-through">
                    ₹{lowPrice.toFixed(0)}
                  </span>
                  <span className="inline-flex items-center text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">
                    Save ₹{saveAmount.toFixed(0)}
                  </span>
                </>
              ) : (
                <span className="text-sm font-black text-slate-900">{hasVariants ? `from ₹${lowPrice.toFixed(0)}` : `₹${lowPrice.toFixed(0)}`}</span>
              )}
              {item.ratingCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700">
                  <Star size={9} fill="currentColor" className="text-amber-500" />
                  {item.ratingAvg.toFixed(1)}
                  <span className="text-slate-400 font-normal">({item.ratingCount})</span>
                </span>
              )}
              {item.preparationTime && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Clock size={9} /> {item.preparationTime}m</span>}
            </div>
            <button
              onClick={onQuickAdd}
              disabled={disabled}
              className={clsx(
                'shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors',
                disabled
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-gold-500 hover:bg-gold-600 text-charcoal-900',
              )}
            >
              <Plus size={12} /> Add{qty > 0 && ` · ${qty}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Item detail half-screen modal ────────────────────────── */
function ItemDetailModal({
  item, onClose, onAdd, onToggleFavorite,
}: {
  item: any;
  onClose: () => void;
  onToggleFavorite?: () => void;
  // picks carries one entry per (variant, qty) the customer wants to
  // add. For an item without variants the list has a single entry with
  // variant=undefined. Toppings + bundlePicks apply to every entry.
  onAdd: (
    picks: Array<{ variant?: any; qty: number }>,
    toppings: CartTopping[],
    bundlePicks?: { selections: string[]; labels: string[] },
  ) => void;
}) {
  // Customer-choice bundle picker state — must run BEFORE variant state
  // because `usePerVariantQty` (below) is gated on it.
  const maxBundlePicks = item.isBundle && item.maxBundleSelections
    ? Number(item.maxBundleSelections) || 0
    : 0;
  // Multi-variant flow: each variant gets its own +/- counter so the
  // customer can pick "Small × 2, Large × 1" in one shot. Disabled for
  // customer-choice bundles where the parent variant decides the bundle
  // price — those keep the single-variant + single-qty path.
  const hasVariants = !!item.variants?.length;
  const usePerVariantQty = hasVariants && maxBundlePicks === 0;

  // Per-variant qty map (used when usePerVariantQty=true). Initialised
  // with 0 for every variant; customer dials up the ones they want.
  const [variantQty, setVariantQty] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    (item.variants || []).forEach((v: any) => { init[v.id] = 0; });
    return init;
  });
  // Single-variant selection — used only on bundle items where we keep
  // the original modal flow. The first variant is preselected.
  const [variantId, setVariantId] = useState<string | ''>(item.variants?.[0]?.id || '');
  // Quantity for non-variant items (and for the bundle/single-variant path).
  const [qty, setQty] = useState(1);
  const [topSel, setTopSel] = useState<Record<string, { selected: boolean; optionId?: string }>>(() => {
    const init: Record<string, { selected: boolean; optionId?: string }> = {};
    (item.itemToppings || []).forEach((l: any) => {
      if (l.topping.options.length) {
        init[l.toppingId] = { selected: !!l.isRequired, optionId: l.isRequired ? l.topping.options[0].id : undefined };
      } else {
        init[l.toppingId] = { selected: !!l.isRequired };
      }
    });
    return init;
  });
  const [bundleSel, setBundleSel] = useState<Set<string>>(new Set());
  const toggleBundlePick = (id: string) => setBundleSel((prev) => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); return next; }
    if (maxBundlePicks > 0 && next.size >= maxBundlePicks) return prev;
    next.add(id);
    return next;
  });

  // Compose the topping list (same for every variant in the picks).
  const toppings: CartTopping[] = [];
  for (const link of item.itemToppings || []) {
    const sel = topSel[link.toppingId];
    if (!sel?.selected && !link.isRequired) continue;
    const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
    if (link.topping.options.length) {
      const optId = sel?.optionId || link.topping.options[0].id;
      const opt = link.topping.options.find((o: any) => o.id === optId);
      if (!opt) continue;
      toppings.push({ toppingId: link.toppingId, optionId: opt.id, label: `${link.topping.name}: ${opt.name}`, priceAdd: basePriceAdd + Number(opt.priceAdd) });
    } else {
      toppings.push({ toppingId: link.toppingId, label: link.topping.name, priceAdd: basePriceAdd });
    }
  }
  const toppingAdd = toppings.reduce((s, t) => s + t.priceAdd, 0);

  // Discounted unit price helper. If the variant / item has a discountInfo
  // payload from the menu endpoint, prefer that (it already reflects the
  // active line-level auto-discount) so the modal total matches what the
  // cart + receipt will show.
  const unitFor = (v?: any) => {
    if (v) {
      return v.discountInfo?.discountedPrice != null
        ? Number(v.discountInfo.discountedPrice)
        : Number(v.effectivePrice ?? v.price);
    }
    return item.discountInfo?.discountedPrice != null
      ? Number(item.discountInfo.discountedPrice)
      : Number(item.effectivePrice ?? item.basePrice);
  };
  const stickerFor = (v?: any) => v
    ? Number(v.effectivePrice ?? v.price)
    : Number(item.effectivePrice ?? item.basePrice);

  // Aggregate the running line total. Per-variant mode sums each row;
  // single-qty mode multiplies one unit by qty.
  let lineTotal = 0;
  let pickedItemCount = 0;
  if (usePerVariantQty) {
    for (const v of item.variants) {
      const q = variantQty[v.id] || 0;
      if (q <= 0) continue;
      pickedItemCount += q;
      lineTotal += (unitFor(v) + toppingAdd) * q;
    }
  } else {
    const variant = item.variants?.find((v: any) => v.id === variantId);
    pickedItemCount = qty;
    lineTotal = (unitFor(variant) + toppingAdd) * qty;
  }

  const galleryImages = [item.imageUrl, ...(item.images?.map((g: any) => g.url) || [])].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl flex flex-col max-h-[80%]" onClick={e => e.stopPropagation()}>
        {/* Header image */}
        <div className="relative">
          {galleryImages.length > 0 ? (
            <div className="flex overflow-x-auto snap-x snap-mandatory rounded-t-3xl">
              {galleryImages.map((url: string, i: number) => (
                <img key={i} src={url} alt="" loading="lazy" decoding="async" className="w-full snap-center shrink-0 h-48 object-cover" />
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
              <FoodGradeDot grade={item.foodGrade} />
              <h3 className="text-base font-bold text-slate-900">{item.name}</h3>
              {item.isPopular && <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">Popular</span>}
            </div>
            {(item.longDescription || item.shortDescription || item.description) && (
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {item.longDescription || item.shortDescription || item.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
              {item.preparationTime && <span className="flex items-center gap-1"><Clock size={10} /> {item.preparationTime} min</span>}
              {item.parcelAvailable ? <span>Parcel available</span> : <span className="text-red-500">Not available for parcel</span>}
              {item.hasLimitedStock && item.availableQuantity > 0 && (
                <span className="inline-flex items-center text-amber-700 font-semibold">
                  {item.availableQuantity <= 5
                    ? `Only ${item.availableQuantity} left`
                    : 'Limited Quantity Available'}
                </span>
              )}
            </div>
          </div>

          {/* Variants — per-variant +/- qty so the customer can pick
              "Small × 2, Large × 1" in one go. Bundles fall back to
              the single-variant + single-qty radio path below. */}
          {hasVariants && usePerVariantQty && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Variants</p>
              <div className="space-y-1.5">
                {item.variants.map((v: any) => {
                  const sticker = stickerFor(v);
                  const unit = unitFor(v);
                  const isDiscounted = unit < sticker - 0.005;
                  const q = variantQty[v.id] || 0;
                  const inc = () => setVariantQty((p) => ({ ...p, [v.id]: (p[v.id] || 0) + 1 }));
                  const dec = () => setVariantQty((p) => ({ ...p, [v.id]: Math.max(0, (p[v.id] || 0) - 1) }));
                  return (
                    <div
                      key={v.id}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                        q > 0 ? 'border-brand-300 bg-brand-50/40' : 'border-slate-100',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{v.name}</p>
                        {v.shortDescription && (
                          <p className="text-[10px] text-slate-400 truncate">{v.shortDescription}</p>
                        )}
                        <p className="text-xs mt-0.5">
                          {isDiscounted ? (
                            <>
                              <span className="font-bold text-emerald-700">₹{unit.toFixed(0)}</span>
                              <span className="ml-1.5 text-slate-400 line-through">₹{sticker.toFixed(0)}</span>
                              <span className="ml-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                Save ₹{(sticker - unit).toFixed(0)}
                              </span>
                            </>
                          ) : (
                            <span className="font-bold text-slate-900">₹{sticker.toFixed(0)}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={dec}
                          disabled={q === 0}
                          className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center disabled:opacity-40"
                          aria-label={`Remove one ${v.name}`}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center font-bold text-sm">{q}</span>
                        <button
                          type="button"
                          onClick={inc}
                          className="w-8 h-8 rounded-lg bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center"
                          aria-label={`Add one ${v.name}`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Bundles keep the single-variant radio so the parent variant
              still drives the bundle price. */}
          {hasVariants && !usePerVariantQty && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Choose size</p>
              <div className="space-y-1.5">
                {item.variants.map((v: any) => {
                  const price = Number(v.effectivePrice ?? v.price);
                  const checked = variantId === v.id;
                  return (
                    <label key={v.id} className={clsx(
                      'flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer',
                      checked ? 'border-brand-300 bg-brand-50/40' : 'border-slate-100',
                    )}>
                      <span className="flex items-center gap-2">
                        <input type="radio" name="variant" checked={checked} onChange={() => setVariantId(v.id)} className="accent-brand-500" />
                        <span>
                          <span className="text-sm font-semibold text-slate-800">{v.name}</span>
                          {v.shortDescription && <span className="block text-[10px] text-slate-400">{v.shortDescription}</span>}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-slate-900">₹{price.toFixed(0)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toppings */}
          {item.itemToppings?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Toppings</p>
              <div className="space-y-2">
                {item.itemToppings.map((link: any) => {
                  const sel = topSel[link.toppingId] || { selected: false };
                  const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
                  const isRadio = link.topping.options.length > 0;
                  return (
                    <div key={link.toppingId} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-slate-800">
                          {link.topping.name}{link.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        {!isRadio && (
                          <input
                            type="checkbox"
                            disabled={link.isRequired}
                            checked={sel.selected}
                            onChange={e => setTopSel(p => ({ ...p, [link.toppingId]: { ...sel, selected: e.target.checked } }))}
                            className="w-5 h-5 accent-brand-500 rounded"
                          />
                        )}
                      </div>
                      {!isRadio && <p className="text-[11px] text-slate-400">+₹{basePriceAdd.toFixed(0)}</p>}
                      {isRadio && (
                        <div className="space-y-1.5 mt-1">
                          {link.topping.options.map((opt: any) => {
                            const checked = sel.optionId === opt.id;
                            return (
                              <label key={opt.id} className={clsx(
                                'flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white border cursor-pointer',
                                checked ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-100',
                              )}>
                                <span className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`topping-${link.toppingId}`}
                                    checked={checked}
                                    onChange={() => setTopSel(p => ({ ...p, [link.toppingId]: { optionId: opt.id, selected: true } }))}
                                    className="accent-brand-500"
                                  />
                                  <span className="text-sm text-slate-700">{opt.name}</span>
                                </span>
                                <span className="text-xs font-bold text-slate-500">+₹{(basePriceAdd + Number(opt.priceAdd)).toFixed(0)}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* "What's inside" — for auto-included bundles (no per-customer
              pick). Read-only list so the diner knows what comes with the
              bundle before they tap Add. The picker UI below replaces this
              for X-of-Y bundles. */}
          {item.isBundle && maxBundlePicks === 0 && Array.isArray(item.bundleChildren) && item.bundleChildren.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                What's inside ({item.bundleChildren.length})
              </p>
              <ul className="space-y-1.5">
                {item.bundleChildren.map((child: any) => {
                  const childName = child.childItem?.name || 'Item';
                  const variantName = child.variant?.name ? ` · ${child.variant.name}` : '';
                  const qtyLabel = (Number(child.quantity) || 1) > 1 ? ` × ${child.quantity}` : '';
                  return (
                    <li
                      key={child.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                      <span className="text-sm font-semibold text-slate-700">
                        {childName}{variantName}{qtyLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Bundle picker — only when maxBundleSelections is set. */}
          {maxBundlePicks > 0 && Array.isArray(item.bundleChildren) && item.bundleChildren.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Pick {maxBundlePicks} of {item.bundleChildren.length}
                </p>
                <span className={clsx(
                  'text-[11px] font-bold px-2 py-0.5 rounded-full',
                  bundleSel.size === maxBundlePicks
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700',
                )}>
                  {bundleSel.size}/{maxBundlePicks} selected
                </span>
              </div>
              <div className="space-y-1.5">
                {item.bundleChildren.map((child: any) => {
                  const checked = bundleSel.has(child.id);
                  const atCap = !checked && bundleSel.size >= maxBundlePicks;
                  const childName = child.childItem?.name || 'Item';
                  const variantName = child.variant?.name ? ` · ${child.variant.name}` : '';
                  const qtyLabel = (Number(child.quantity) || 1) > 1 ? ` × ${child.quantity}` : '';
                  return (
                    <label
                      key={child.id}
                      className={clsx(
                        'flex items-center justify-between px-3 py-2.5 rounded-xl border',
                        checked ? 'border-brand-300 bg-brand-50/40' : 'border-slate-100 bg-white',
                        atCap && 'opacity-50',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={atCap}
                          onChange={() => toggleBundlePick(child.id)}
                          className="w-4 h-4 accent-brand-500 rounded"
                        />
                        <span className="text-sm font-semibold text-slate-800">
                          {childName}{variantName}{qtyLabel}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Single-qty selector — only when item has NO variants
              (per-variant flow lives inside the variants section above)
              or when bundle path is active. */}
          {!usePerVariantQty && (
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
              <p className="text-sm font-semibold text-slate-700">Quantity</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><Minus size={14} /></button>
                <span className="w-6 text-center font-bold text-sm">{qty}</span>
                <button onClick={() => setQty(q => q + 1)} className="w-8 h-8 bg-brand-500 text-white rounded-lg flex items-center justify-center"><Plus size={14} /></button>
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-base font-bold text-slate-900">₹{lineTotal.toFixed(0)}</span>
          <button
            onClick={() => {
              // Build the picks list. Per-variant mode collects every
              // variant the customer dialled up; single-qty mode collapses
              // to one pick (variant or undefined).
              let picks: Array<{ variant?: any; qty: number }> = [];
              if (usePerVariantQty) {
                for (const v of item.variants) {
                  const q = variantQty[v.id] || 0;
                  if (q > 0) picks.push({ variant: v, qty: q });
                }
              } else {
                const variant = item.variants?.find((v: any) => v.id === variantId);
                picks = [{ variant, qty }];
              }
              if (maxBundlePicks > 0) {
                if (bundleSel.size !== maxBundlePicks) return;
                const ids = Array.from(bundleSel);
                const labels = ids.map((id) => {
                  const child = item.bundleChildren?.find((c: any) => c.id === id);
                  if (!child) return '';
                  const v = child.variant?.name ? ` · ${child.variant.name}` : '';
                  return `${child.childItem?.name || 'Item'}${v}`;
                });
                onAdd(picks, toppings, { selections: ids, labels });
              } else if (item.isBundle && Array.isArray(item.bundleChildren) && item.bundleChildren.length > 0) {
                // Auto-included bundle: stash the children labels on the cart
                // line so the cart, receipt and tracking views can surface
                // "What's inside" without re-fetching. Empty selections =
                // "no user choice was required", which the server already
                // skips validation for (maxPicks === 0 path).
                const labels = item.bundleChildren.map((child: any) => {
                  const v = child.variant?.name ? ` · ${child.variant.name}` : '';
                  const q = (Number(child.quantity) || 1) > 1 ? ` × ${child.quantity}` : '';
                  return `${child.childItem?.name || 'Item'}${v}${q}`;
                });
                onAdd(picks, toppings, { selections: [], labels });
              } else {
                onAdd(picks, toppings);
              }
            }}
            disabled={
              (maxBundlePicks > 0 && bundleSel.size !== maxBundlePicks)
              || pickedItemCount === 0
            }
            className="flex-1 bg-gold-500 hover:bg-gold-600 text-charcoal-900 py-3 rounded-2xl text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {maxBundlePicks > 0 && bundleSel.size !== maxBundlePicks
              ? `Pick ${maxBundlePicks - bundleSel.size} more`
              : pickedItemCount === 0
                ? 'Pick at least 1 variant'
                : `Add ${pickedItemCount} to cart · ₹${lineTotal.toFixed(0)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

