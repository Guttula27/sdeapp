import { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, Minus, ShoppingBag, Trash2, Banknote, Smartphone,
  Phone, Package, X as XIcon, Search, Lock, Table2,
  Maximize2, Minimize2,
} from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import { allowsSeating } from '../../utils/outletType';
import { isPrinterConnected, printCustomerReceipt, isBluetoothSupported } from '../../utils/bluetoothPrinter';
import { buildReceiptPayload } from '../../utils/receiptPayload';
import { getCachedMenu, setCachedMenu, saveOfflineOrder, type OfflineOrder } from '../../utils/idb';

type BookingMode = 'counter' | 'table';

const FOOD_GRADE_COLOR: Record<string, string> = { VEG: '#16a34a', NON_VEG: '#dc2626', VEGAN: '#0d9488' };
function FoodGradeDot({ grade }: { grade?: string }) {
  const color = FOOD_GRADE_COLOR[grade || 'VEG'];
  return (
    <span className="inline-flex items-center justify-center shrink-0"
      style={{ width: 12, height: 12, border: `1.5px solid ${color}`, borderRadius: 2 }}>
      <span style={{ width: 6, height: 6, background: color, borderRadius: '50%' }} />
    </span>
  );
}

type CartTopping = {
  toppingId: string;
  optionId?: string;
  label: string;      // human-readable for the cart sidebar e.g. "Sauce: Sriracha"
  priceAdd: number;
};

type CartLine = {
  cartLineId: string;
  itemId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  gstRate?: number;
  // Toppings selected on the item detail modal. Cart line key composites
  // these so "Burger w/ extra patty" stacks separately from "Burger".
  toppings?: CartTopping[];
  // Menu snapshot at add-time — used to group lines in the cart sidebar and
  // print receipts. Server snapshots the same value on OrderItem.menuId via
  // the item->subcategory->category chain.
  menuId?: string;
  menuName?: string;
};

export default function PlaceOrderPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const navigate = useNavigate();
  const outletId = user?.outletId || 'demo-outlet';

  const [menu, setMenu] = useState<any[]>([]);
  const [openStatus, setOpenStatus] = useState<{ isOpen: boolean; reason: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('');
  const [activeSub, setActiveSub] = useState('');
  const [search, setSearch] = useState('');

  // Multiple-menus state. Populated from the outlet's menu list; we only
  // show tab chrome when there's more than one enabled menu, otherwise the
  // single-menu UI is unchanged.
  const [enabledMenus, setEnabledMenus] = useState<Array<{ id: string; name: string }>>([]);
  const [activeMenuId, setActiveMenuId] = useState<string>('');

  // Cart survives a tab reload — keyed by outletId so two cashiers on
  // different outlets can't clobber each other. Cleared on order
  // placement success.
  // Auto-print receipt on successful order placement. Three conditions
  // must hold: (1) outlet opted in via receiptAutoPrint, (2) a printer
  // is configured, (3) Web Bluetooth is supported AND the printer is
  // currently connected (the connection handle is held in memory; the
  // user must have "Connect printer" pressed at least once this session).
  // Auto-print is best-effort — failures don't block the order flow.
  const maybeAutoPrintReceipt = async (createdOrder: any) => {
    if (!outlet?.receiptAutoPrint) return;
    const printerId = outlet?.receiptPrinterId;
    if (!printerId || !isBluetoothSupported() || !isPrinterConnected(printerId)) return;
    // Re-fetch the full order so the payload has all the receipt
    // includes (couponUsages + rewardTransactions + outlet address).
    const { data } = await api.get(`/outlets/${outletId}/orders/${createdOrder.id}`);
    await printCustomerReceipt(printerId, buildReceiptPayload(data.data));
  };

  const cartKey = `placeorder-cart-${outletId}`;
  const [cart, setCart] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem(cartKey) || '[]'); }
    catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); }
    catch { /* quota / disabled storage — best-effort */ }
  }, [cart, cartKey]);
  const [variantPick, setVariantPick] = useState<any>(null);

  const [customerPhone, setCustomerPhone] = useState('');
  const [isParcel, setIsParcel] = useState(false);
  const [placing, setPlacing] = useState(false);

  // Fullscreen toggle — uses the browser Fullscreen API on the page
  // wrapper so a counter station or a tablet running in landscape can use
  // every pixel. Tracked via the `fullscreenchange` event so the icon
  // flips back if the user exits via Escape. iOS Safari doesn't implement
  // requestFullscreen on arbitrary elements; the button silently no-ops.
  const pageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const toggleFullscreen = async () => {
    const el = pageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* unavailable — silently ignore */ }
  };
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Booking mode + table-service state. Only meaningful on Hybrid/Dine-in
  // outlets — for self-service we hide the "Table" tab entirely.
  const [outlet, setOutlet] = useState<any>(null);
  const [tableTypes, setTableTypes] = useState<any[]>([]);
  const [bookingMode, setBookingMode] = useState<BookingMode>('counter');
  const [tableTypeId, setTableTypeId] = useState('');
  const [tableId, setTableId] = useState('');

  // Hydrate the page state from a cached or freshly-fetched menu
  // bundle. Single applicator so the cache-first and network paths
  // produce byte-identical UI state.
  const applyMenuBundle = useCallback((
    cats: any[],
    menusList: any[],
    outletMeta: any | null,
    tableTypesList: any[] | null,
  ) => {
    setMenu(cats);
    if (outletMeta) setOutlet(outletMeta);
    if (tableTypesList) setTableTypes(tableTypesList);
    const categoryMenuIds = new Set<string>(cats.map((c: any) => c.menuId).filter(Boolean));
    const list: Array<{ id: string; name: string; isEnabled: boolean }> = (menusList || []).map((m: any) => ({
      id: m.id, name: m.name, isEnabled: m.outletMenu?.isEnabled !== false,
    }));
    const usable = list.filter((m) => m.isEnabled && categoryMenuIds.has(m.id));
    setEnabledMenus(usable);
    setActiveMenuId((prev) => prev || usable[0]?.id || '');
    setActiveCat((prev) => {
      if (prev && cats.find((c: any) => c.id === prev)) return prev;
      const firstCat = cats.find((c: any) => c.menuId === (usable[0]?.id || '')) || cats[0];
      return firstCat?.id || '';
    });
    setActiveSub((prev) => {
      if (prev) {
        for (const c of cats) for (const s of (c.subcategories || [])) if (s.id === prev) return prev;
      }
      const firstCat = cats.find((c: any) => c.menuId === (usable[0]?.id || '')) || cats[0];
      return firstCat?.subcategories?.[0]?.id || '';
    });
  }, []);

  const fetchMenu = useCallback(async () => {
    // Cache-first: paint whatever IDB has immediately, then revalidate
    // from the network in the background. This collapses the 3x-fetch
    // bug (the prior fetchMenu re-fired every time outlet/tableTypes
    // changed) and gives an instant first paint on warm devices.
    const cached = await getCachedMenu(outletId);
    if (cached) {
      applyMenuBundle(cached.menu || [], cached.menus || [], cached.outlet ?? null, cached.tableTypes ?? null);
      setLoading(false); // surface something usable while we revalidate
    } else {
      setLoading(true);
    }

    try {
      // Bundle every read this page needs into one cycle so the cache
      // write below is atomic — no more partial caches missing outlet
      // meta or table types.
      const [menuRes, statusRes, menusRes, outletRes, tableTypesRes] = await Promise.all([
        api.get(`/outlets/${outletId}/menu`),
        api.get(`/outlets/${outletId}/open-status`).catch(() => null),
        api.get(`/outlets/${outletId}/menus`).catch(() => null),
        api.get(`/outlets/${outletId}`).catch(() => null),
        api.get(`/outlets/${outletId}/table-types`).catch(() => null),
      ]);
      const cats = menuRes.data.data || [];
      const menusList = menusRes?.data?.data || [];
      const outletMeta = outletRes?.data?.data ?? null;
      const tableTypesList = tableTypesRes?.data?.data ?? [];

      applyMenuBundle(cats, menusList, outletMeta, tableTypesList);
      if (statusRes) setOpenStatus(statusRes.data.data);

      // Write-through ONLY once all data is in hand — prevents the
      // prior bug where outlet/tableTypes were persisted as null/[]
      // because they hadn't loaded yet.
      setCachedMenu({
        outletId,
        cachedAt: Date.now(),
        menu: cats,
        menus: menusList,
        outlet: outletMeta,
        tableTypes: tableTypesList,
      }).catch(() => {});
    } catch (e: any) {
      // Network down or API unreachable. If the cache-first path
      // already painted, we're done — just signal stale data. Otherwise
      // surface the error so the screen isn't a silent blank.
      if (cached) {
        toast('Using cached menu — you appear to be offline', { icon: '📡' });
      } else {
        toast.error(e?.response?.data?.message || 'Could not load menu and no cache is available');
      }
    } finally {
      setLoading(false);
    }
  }, [outletId, applyMenuBundle]);

  // When the active menu changes, snap to its first category so the items
  // panel doesn't go blank because the prior category belongs to another menu.
  useEffect(() => {
    if (!activeMenuId) return;
    const cats = menu.filter((c: any) => c.menuId === activeMenuId);
    if (!cats.find((c: any) => c.id === activeCat)) {
      const first = cats[0];
      if (first) {
        setActiveCat(first.id);
        setActiveSub(first.subcategories?.[0]?.id || '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenuId]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // Service staff assignment: when the logged-in user is a worker on one or
  // more service stations at this outlet, the table picker is restricted to
  // the tables of those stations. Empty array = no restriction (admins).
  const [myStationTableIds, setMyStationTableIds] = useState<string[] | null>(null);

  // Outlet meta + table types are loaded by fetchMenu above (folded in
  // so the IDB cache write is atomic across all four reads). This
  // effect only pulls the caller's service-station assignments to
  // scope the table picker — those don't need offline caching.
  useEffect(() => {
    api.get(`/outlets/${outletId}/service-stations/mine`)
      .then(({ data }) => {
        const stations = data.data || [];
        if (!stations.length) { setMyStationTableIds(null); return; }
        const ids = stations.flatMap((s: any) => (s.tables || []).map((t: any) => t.tableId));
        setMyStationTableIds(ids);
      })
      .catch(() => setMyStationTableIds(null));
  }, [outletId]);

  const seatingAllowed = allowsSeating(outlet?.outletType);
  // For service staff, hide table types whose tables they aren't assigned
  // to, and clip each remaining type's tables list to only their tables.
  const visibleTableTypes: any[] = (() => {
    if (!myStationTableIds) return tableTypes;
    const allowed = new Set(myStationTableIds);
    return tableTypes
      .map((tt: any) => ({
        ...tt,
        tables: (tt.tables || []).filter((t: any) => allowed.has(t.id)),
      }))
      .filter((tt: any) => tt.tables.length > 0);
  })();
  const selectedTableType = visibleTableTypes.find((t) => t.id === tableTypeId);
  const tablesForType: any[] = selectedTableType?.tables ?? [];
  // Dine-in Postpaid is the only outlet type that gets the open-tab UX.
  const isPostpaidTableFlow = bookingMode === 'table' && outlet?.outletType === 'DINE_IN_POSTPAID';
  const [openOrder, setOpenOrder] = useState<any | null>(null);
  // Every open (unpaid postpaid) tab at the currently-selected table.
  // Drives the picker so the service desk can see all of "what's
  // running" on this table without having to type each customer's
  // phone number to find it.
  const [tableOpenTabs, setTableOpenTabs] = useState<any[]>([]);
  // 'idle' = adding items / placing; 'billing' = Bill Now pressed, show Cash/UPI.
  const [billingState, setBillingState] = useState<'idle' | 'billing'>('idle');

  // Whenever the staff picks a different table OR types a different
  // customer phone on a postpaid flow, refresh the open order. Open
  // tabs on a single table are customer-scoped — without a phone we
  // can't pick a tab safely, so the call resolves to null and the UI
  // starts a fresh order. Trimmed phones below 10 chars are skipped
  // to avoid a request per keystroke.
  const refreshOpenOrder = useCallback(async () => {
    if (!isPostpaidTableFlow || !tableId) { setOpenOrder(null); return; }
    const phone = customerPhone.trim();
    if (phone.length < 10) { setOpenOrder(null); return; }
    try {
      const { data } = await api.get(`/outlets/${outletId}/orders/open`, {
        params: { tableId, customerPhone: phone },
      });
      setOpenOrder(data.data ?? null);
    } catch {
      setOpenOrder(null);
    }
  }, [isPostpaidTableFlow, tableId, outletId, customerPhone]);
  useEffect(() => { refreshOpenOrder(); setBillingState('idle'); }, [refreshOpenOrder]);

  // Whenever the table changes (or one of the table's tabs gets billed
  // / paid / cancelled), refresh the list of open tabs at this table so
  // the picker stays current. The endpoint is the same one the service
  // desk uses, scoped by tableId.
  const refreshTableTabs = useCallback(async () => {
    if (!isPostpaidTableFlow || !tableId) { setTableOpenTabs([]); return; }
    try {
      const { data } = await api.get(`/outlets/${outletId}/orders/service-desk/open-tabs`, {
        params: { tableId },
      });
      setTableOpenTabs((data.data as any[]) || []);
    } catch {
      setTableOpenTabs([]);
    }
  }, [isPostpaidTableFlow, tableId, outletId]);
  useEffect(() => { refreshTableTabs(); }, [refreshTableTabs]);

  // Pick one of the listed tabs → make it the active order for further
  // edits. Pulls phone + customer name into the form so the staff
  // doesn't have to retype, and clears the cart so the next add lands
  // on the correct line.
  const selectTab = (tab: any) => {
    setOpenOrder(tab);
    if (tab?.customer?.phone) setCustomerPhone(tab.customer.phone);
    setBillingState('idle');
  };
  // Start a fresh tab on the same table — clears openOrder and the
  // phone field so staff can enter a new customer.
  const startNewTab = () => {
    setOpenOrder(null);
    setCustomerPhone('');
    setBillingState('idle');
  };

  // If the outlet type later changes such that seating is no longer allowed
  // (or types/tables vanish), keep the booking mode coherent.
  useEffect(() => {
    if (!seatingAllowed && bookingMode === 'table') setBookingMode('counter');
  }, [seatingAllowed, bookingMode]);
  useEffect(() => {
    if (tableTypeId && !selectedTableType) { setTableTypeId(''); setTableId(''); }
  }, [tableTypeId, selectedTableType]);
  useEffect(() => {
    if (tableId && !tablesForType.some((t) => t.id === tableId)) setTableId('');
  }, [tableId, tablesForType]);

  useEffect(() => {
    const cat = menu.find(c => c.id === activeCat);
    if (cat?.subcategories?.length) setActiveSub(cat.subcategories[0].id);
  }, [activeCat, menu]);

  // ── Cart ops ─────────────────────────────────────────────
  // Composite cart-line key — same (item, variant, topping signature)
  // combinations stack into one line; different ones stay separate.
  const lineKey = (itemId: string, variantId?: string, toppings?: CartTopping[]) => {
    const sig = (toppings || [])
      .map((t) => `${t.toppingId}:${t.optionId || ''}`)
      .sort()
      .join('|');
    return `${itemId}-${variantId || ''}-${sig}`;
  };
  // Look up an item's menu via its category. Falls back gracefully when we
  // can't resolve (single-menu mode just stamps nothing).
  const resolveMenuForItem = (itemId: string): { id?: string; name?: string } => {
    for (const cat of menu) {
      for (const sub of cat.subcategories || []) {
        if ((sub.items || []).some((it: any) => it.id === itemId)) {
          const menuRow = enabledMenus.find((m) => m.id === cat.menuId);
          return { id: cat.menuId || undefined, name: menuRow?.name };
        }
      }
    }
    return {};
  };
  const addToCart = (item: any, variant: any | undefined, toppings: CartTopping[], qty: number) => {
    const base = variant
      ? Number(variant.effectivePrice ?? variant.price)
      : Number(item.effectivePrice ?? item.basePrice);
    const toppingsAdd = toppings.reduce((s, t) => s + t.priceAdd, 0);
    const unitPrice = base + toppingsAdd;
    const m = resolveMenuForItem(item.id);
    setCart(prev => {
      const id = lineKey(item.id, variant?.id, toppings);
      const hit = prev.find(c => c.cartLineId === id);
      if (hit) return prev.map(c => c.cartLineId === id ? { ...c, quantity: c.quantity + qty } : c);
      return [...prev, {
        cartLineId: id,
        itemId: item.id,
        variantId: variant?.id,
        name: item.name,
        variantName: variant?.name,
        unitPrice,
        quantity: qty,
        gstRate: item.gstRate != null ? Number(item.gstRate) : 0,
        toppings: toppings.length ? toppings : undefined,
        menuId: m.id,
        menuName: m.name,
      }];
    });
  };
  // Click on an item — opens the detail modal which lets the cashier pick
  // variants, toggle toppings, choose quantity. Everything routes through
  // the modal now so toppings are never silently skipped.
  const tryAdd = (item: any) => {
    if (openStatus && !openStatus.isOpen) {
      toast.error(`Outlet is currently closed${openStatus.reason ? ` · ${openStatus.reason}` : ''}`);
      return;
    }
    if (!item.isAvailable) {
      toast.error(`${item.name} is currently not available`);
      return;
    }
    setVariantPick(item);
  };
  const updateQty = (id: string, delta: number) =>
    setCart(prev =>
      prev.map(c => c.cartLineId === id ? { ...c, quantity: c.quantity + delta } : c)
          .filter(c => c.quantity > 0),
    );
  const removeLine = (id: string) => setCart(prev => prev.filter(c => c.cartLineId !== id));

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  // Per-line estimate using the item's gstRate; server recomputes authoritatively.
  const taxAmount = cart.reduce(
    (s, c) => s + c.unitPrice * c.quantity * ((c.gstRate ?? 0) / 100),
    0,
  );
  const totalAmount = subtotal + taxAmount;
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  // ── Place order ──────────────────────────────────────────
  const submit = async (mode: 'CASH' | 'UPI') => {
    if (!cart.length) return;
    if (openStatus && !openStatus.isOpen) {
      toast.error(`Outlet is currently closed${openStatus.reason ? ` · ${openStatus.reason}` : ''}`);
      return;
    }
    if (bookingMode === 'table' && !tableId) {
      toast.error('Pick a table before placing this order');
      return;
    }
    setPlacing(true);
    const isTableOrder = bookingMode === 'table';
    const body = {
      isParcel: isTableOrder ? false : isParcel,
      tableId: isTableOrder ? tableId : undefined,
      items: cart.map(c => ({
        itemId: c.itemId,
        variantId: c.variantId,
        quantity: c.quantity,
        // Toppings forwarded in the canonical { toppingId, optionId? }
        // shape OrdersService.resolveOrderItems expects.
        toppings: c.toppings?.length
          ? c.toppings.map((t) => ({ toppingId: t.toppingId, optionId: t.optionId }))
          : undefined,
      })),
      customerPhone: customerPhone.trim() || undefined,
      paymentMode: mode,
    };
    // Mint the provisional orderNumber up-front and use it as the
    // Idempotency-Key. If the call later fails offline, the same string
    // identifies the IndexedDB snapshot, so when the outbox eventually
    // replays the request the api replay helper can mark that snapshot
    // synced + record the server-issued ON- number.
    const provisional = `OFF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(-3).toUpperCase()}`;
    try {
      const { data } = await api.post(`/outlets/${outletId}/orders`, body, {
        headers: { 'Idempotency-Key': provisional },
        // Labelled so the offline banner can show "Place order" if this
        // ends up in the outbox via the api interceptor's failure path.
        __outboxLabel: 'Place order',
      } as any);
      toast.success(`Order ${data.data.orderNumber} placed`);
      // Auto-print receipt if the outlet's receiptAutoPrint flag is
      // set AND a printer is configured AND it's currently connected.
      // Best-effort: failures toast but don't block navigation.
      try { await maybeAutoPrintReceipt(data.data); }
      catch (e: any) { toast.error(`Receipt print failed: ${e?.message ?? e}`); }
      setCart([]);
      // navigate() can unmount before the persist-cart useEffect fires
      // with the empty array, so wipe the localStorage row directly to
      // guarantee the next Place Order visit starts clean.
      try { localStorage.removeItem(cartKey); } catch { /* best-effort */ }
      setCustomerPhone('');
      setIsParcel(false);
      setTableTypeId('');
      setTableId('');
      navigate('/orders');
    } catch (e: any) {
      // ─── Offline fallback ──────────────────────────────────────
      // If the failure is a network-level one, the api interceptor has
      // already queued the request to the outbox for replay. From the
      // staff's perspective we treat that as success: assign a
      // provisional orderNumber, snapshot the cart for receipt reprints,
      // and fire the printer if configured. The drain on reconnect
      // (OfflineBanner) will replay the original POST so the server
      // creates the canonical record.
      const isNetwork = !e?.response;
      if (isNetwork) {
        await placeOfflineOrder(provisional, isTableOrder, body, mode);
        setCart([]);
        try { localStorage.removeItem(cartKey); } catch { /* best-effort */ }
        setCustomerPhone('');
        setIsParcel(false);
        setTableTypeId('');
        setTableId('');
        navigate('/orders');
      } else {
        toast.error(e.response?.data?.message || 'Failed to place order');
      }
    } finally {
      setPlacing(false);
    }
  };

  // Build the snapshot, persist it locally, and print the receipt with
  // a provisional orderNumber. Used by the offline branch of submit().
  const placeOfflineOrder = async (
    provisional: string,
    isTableOrder: boolean,
    body: any,
    mode: 'CASH' | 'UPI',
  ) => {
    // Expand the cart with full item names so the receipt can render
    // without re-querying the menu (which would also be offline).
    const itemMeta = new Map<string, any>();
    for (const cat of menu) {
      for (const sub of cat.subcategories || []) {
        for (const it of sub.items || []) itemMeta.set(it.id, it);
      }
    }
    const items = cart.map((c) => {
      const meta = itemMeta.get(c.itemId);
      return {
        id: `${provisional}-${c.cartLineId}`,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        totalPrice: c.unitPrice * c.quantity,
        gstRate: c.gstRate ?? 0,
        item: { name: meta?.name ?? c.name ?? 'Item' },
        variant: c.variantId ? { name: c.variantName ?? null } : null,
      };
    });
    const snapshotSubtotal = items.reduce((s, i) => s + i.totalPrice, 0);
    const snapshotTax = items.reduce((s, i) => s + i.totalPrice * (Number(i.gstRate) / 100), 0);
    const snapshotTotal = snapshotSubtotal + snapshotTax;

    const snapshot: any = {
      id: provisional,
      orderNumber: provisional,
      tokenNumber: null,
      isParcel: isTableOrder ? false : isParcel,
      outletId,
      outlet: outlet ? {
        name: outlet.name,
        addressLine1: outlet.addressLine1,
        addressLine2: outlet.addressLine2,
        address: outlet.address,
        city: outlet.city,
        state: outlet.state,
        pincode: outlet.pincode,
        gstNumber: outlet.gstNumber,
        phone: outlet.phone,
      } : null,
      table: isTableOrder
        ? { number: tableTypes.flatMap((t: any) => t.tables || []).find((t: any) => t.id === tableId)?.number ?? null }
        : null,
      customer: body.customerPhone ? { name: null, phone: body.customerPhone } : null,
      items,
      subtotal: snapshotSubtotal,
      taxAmount: snapshotTax,
      sgstAmount: snapshotTax / 2,
      cgstAmount: snapshotTax / 2,
      parcelAmount: 0,
      discountAmount: 0,
      totalAmount: snapshotTotal,
      payments: [{ mode, amount: snapshotTotal, status: 'SUCCESS' }],
      couponUsages: [],
      rewardTransactions: [],
    };
    const record: OfflineOrder = {
      id: provisional,
      outletId,
      createdAt: Date.now(),
      syncState: 'pending',
      snapshot,
    };
    await saveOfflineOrder(record);
    toast.success(`Offline · order saved as ${provisional}`, { duration: 6000 });

    // Best-effort print: printer is bluetooth, so it works without
    // network. Auto-print + manual rules still apply.
    if (outlet?.receiptAutoPrint && outlet?.receiptPrinterId && isBluetoothSupported() && isPrinterConnected(outlet.receiptPrinterId)) {
      try {
        await printCustomerReceipt(outlet.receiptPrinterId, buildReceiptPayload(snapshot));
      } catch (err: any) {
        toast.error(`Receipt print failed: ${err?.message ?? err}`);
      }
    }
  };

  // ── Postpaid (Dine-in Postpaid) handlers ─────────────────────
  const placePostpaid = async () => {
    if (!cart.length) return;
    if (bookingMode !== 'table' || !tableId) {
      toast.error('Pick a table before placing this order');
      return;
    }
    setPlacing(true);
    try {
      const itemsPayload = cart.map(c => ({
        itemId: c.itemId,
        variantId: c.variantId,
        quantity: c.quantity,
        toppings: c.toppings?.length
          ? c.toppings.map((t) => ({ toppingId: t.toppingId, optionId: t.optionId }))
          : undefined,
      }));
      if (openOrder) {
        // Append to the open order — no new order number, no payment.
        await api.post(`/outlets/${outletId}/orders/${openOrder.id}/items`, { items: itemsPayload });
        toast.success('Items added to order');
      } else {
        await api.post(`/outlets/${outletId}/orders`, {
          tableId,
          isPostpaid: true,
          items: itemsPayload,
          customerPhone: customerPhone.trim() || undefined,
        });
        toast.success('Order placed — bill stays open');
      }
      setCart([]);
      try { localStorage.removeItem(cartKey); } catch { /* best-effort */ }
      await refreshOpenOrder();
      // Tab list also needs to refresh — a new tab just joined it,
      // or an existing tab's total just changed.
      await refreshTableTabs();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const pressBillNow = async () => {
    if (!openOrder) return;
    setPlacing(true);
    try {
      const { data } = await api.patch(`/outlets/${outletId}/orders/${openOrder.id}/bill-request`);
      setOpenOrder(data.data);
      setBillingState('billing');
      await refreshTableTabs();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to request bill');
    } finally {
      setPlacing(false);
    }
  };

  const payBill = async (mode: 'CASH' | 'UPI') => {
    if (!openOrder) return;
    setPlacing(true);
    try {
      // Cash auto-confirms server-side; UPI returns a PENDING payment id we
      // immediately confirm because staff just verified the gateway transfer.
      const { data } = await api.post('/payments/initiate', {
        orderId: openOrder.id,
        mode,
        amount: Number(openOrder.totalAmount),
      });
      if (mode === 'UPI' && data?.data?.paymentId) {
        await api.post(`/payments/${data.data.paymentId}/confirm`, { gatewayRef: '' });
      }
      toast.success(`Payment recorded · ₹${Number(openOrder.totalAmount).toFixed(2)}`);
      setOpenOrder(null);
      setBillingState('idle');
      setCart([]);
      try { localStorage.removeItem(cartKey); } catch { /* best-effort */ }
      setTableTypeId('');
      setTableId('');
      navigate('/orders');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to record payment');
    } finally {
      setPlacing(false);
    }
  };

  const cat = menu.find(c => c.id === activeCat);
  const subs = cat?.subcategories || [];
  const subCurrent = subs.find((s: any) => s.id === activeSub);
  const allItems = subs.flatMap((s: any) => s.items || []);
  // Keep unavailable items in the list — they render as disabled "Currently not available".
  const items = search
    ? allItems.filter((i: any) => i.isDisplayed && i.name?.toLowerCase().includes(search.toLowerCase()))
    : (subCurrent?.items || []).filter((i: any) => i.isDisplayed);

  const outletClosed = !!openStatus && !openStatus.isOpen;

  return (
    // In fullscreen we layer our own background + use the whole viewport
    // since the global Layout chrome is bypassed by the Fullscreen API.
    <div
      ref={pageRef}
      className={clsx(
        fullscreen ? 'h-screen bg-slate-50' : 'h-[calc(100dvh-64px)] -m-6',
      )}
    >
      {outletClosed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800">
          <Lock size={14} className="shrink-0" />
          <p className="text-xs font-semibold">
            Outlet is currently closed{openStatus?.reason ? ` · ${openStatus.reason}` : ''}. Place Order is disabled.
          </p>
        </div>
      )}
      <div className="flex h-full">
        {/* ── Left 70%: menu ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50" style={{ flexBasis: '60%' }}>
          {/* Menu tabs — primary navigation band. Distinct dark background
              so staff clearly read "menu" as the top-level layer and
              "categories" below as sub-nav. Hidden in single-menu outlets. */}
          {enabledMenus.length > 1 && (
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2.5 flex items-center gap-3 border-b border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Menu</p>
              <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide">
                {enabledMenus.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveMenuId(m.id)}
                    className={clsx(
                      'px-4 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-all',
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

          {/* Categories — nested sub-nav under the active menu. */}
          <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide">
              {menu
                .filter((c) => !activeMenuId || c.menuId === activeMenuId)
                .map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={clsx(
                    'px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap shrink-0',
                    activeCat === c.id ? 'bg-brand-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="input pl-8 py-1.5 text-sm w-48"
              />
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn-ghost p-2 text-slate-500 hover:text-slate-800 shrink-0"
              title={fullscreen ? 'Exit full screen' : 'Full screen — counter / landscape tablet'}
            >
              {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>

          {/* Sub + items */}
          <div className="flex-1 flex min-h-0">
            {/* Subcategories */}
            <aside className="w-32 bg-white border-r border-slate-100 overflow-y-auto shrink-0">
              {subs.map((sub: any) => {
                const thumb = sub.imageUrl
                  || sub.items?.find((i: any) => i.thumbnailUrl || i.imageUrl)?.thumbnailUrl
                  || sub.items?.find((i: any) => i.thumbnailUrl || i.imageUrl)?.imageUrl;
                const active = activeSub === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => { setActiveSub(sub.id); setSearch(''); }}
                    className={clsx(
                      'flex flex-col items-center w-full px-2 py-3 gap-1.5 border-l-[3px] transition-all',
                      active ? 'border-brand-500 bg-brand-50/60' : 'border-transparent hover:bg-slate-50',
                    )}
                  >
                    <div className={clsx(
                      'w-14 h-14 rounded-xl overflow-hidden border shrink-0',
                      active ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200',
                    )}>
                      {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-slate-100 flex items-center justify-center">🍽️</div>}
                    </div>
                    <span className={clsx('text-[11px] font-semibold leading-tight text-center line-clamp-2',
                      active ? 'text-brand-700' : 'text-slate-600')}>
                      {sub.name}
                    </span>
                  </button>
                );
              })}
            </aside>

            {/* Items */}
            <main className="flex-1 overflow-y-auto p-3 space-y-2 min-w-0">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)
              ) : items.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-12">
                  Currently there are no items available
                </p>
              ) : (
                items.map((item: any) => {
                  const lines = cart.filter(c => c.itemId === item.id);
                  const qty = lines.reduce((s, l) => s + l.quantity, 0);
                  const hasVariants = !!item.variants?.length;
                  const lowPrice = hasVariants
                    ? Math.min(...item.variants.map((v: any) => Number(v.effectivePrice ?? v.price)))
                    : Number(item.effectivePrice ?? item.basePrice);
                  const disabled = outletClosed || !item.isAvailable;
                  const disabledReason = outletClosed
                    ? 'Outlet closed'
                    : !item.isAvailable
                      ? 'Currently not available'
                      : null;
                  return (
                    <div
                      key={item.id}
                      onClick={() => !disabled && tryAdd(item)}
                      role={disabled ? undefined : 'button'}
                      tabIndex={disabled ? -1 : 0}
                      className={clsx(
                        'bg-white rounded-2xl border p-3 flex items-center gap-3 transition-colors',
                        disabled
                          ? 'border-slate-100 opacity-60 cursor-not-allowed'
                          : 'border-slate-100 cursor-pointer hover:border-brand-200',
                      )}
                    >
                      {item.thumbnailUrl || item.imageUrl ? (
                        <img src={item.thumbnailUrl || item.imageUrl} alt=""
                          className={clsx('w-14 h-14 rounded-xl object-cover shrink-0', disabled && 'grayscale')} />
                      ) : (
                        <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">🍽️</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <FoodGradeDot grade={item.foodGrade} />
                          <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                          {disabledReason && (
                            <span className="inline-flex items-center text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">
                              {disabledReason}
                            </span>
                          )}
                        </div>
                        {item.shortDescription && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">{item.shortDescription}</p>
                        )}
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                          {hasVariants ? `from ₹${lowPrice.toFixed(0)}` : `₹${lowPrice.toFixed(0)}`}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); tryAdd(item); }}
                        disabled={disabled}
                        className={clsx(
                          'shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold',
                          disabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-brand-500 hover:bg-brand-600 text-white',
                        )}
                      >
                        <Plus size={12} /> Add{qty > 0 && ` · ${qty}`}
                      </button>
                    </div>
                  );
                })
              )}
            </main>
          </div>
        </div>

        {/* ── Right 30%: cart ────────────────────────────────── */}
        <aside className="w-[40%] min-w-[340px] max-w-[520px] bg-white border-l border-slate-100 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={15} className="text-brand-500" />
              <p className="text-sm font-bold text-slate-900">Cart</p>
              <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                {cartCount} item{cartCount !== 1 ? 's' : ''}
              </span>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-[11px] text-slate-400 hover:text-red-500">Clear</button>
            )}
          </div>

          {/* Lines */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {isPostpaidTableFlow && openOrder?.items?.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lock size={11} className="text-slate-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Placed · {openOrder.orderNumber}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {openOrder.items.map((oi: any) => (
                    <div key={oi.id} className="bg-slate-100/70 rounded-xl px-3 py-1.5">
                      <p className="text-[11px] font-semibold text-slate-700 truncate">
                        {oi.item?.name}{oi.variant?.name ? ` · ${oi.variant.name}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        ₹{Number(oi.unitPrice).toFixed(2)} × {oi.quantity} = ₹{Number(oi.totalPrice).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-3 mb-1.5">New items</p>
                )}
              </div>
            )}
            {cart.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-400 italic">
                {openOrder ? 'No new items yet — pick from the menu' : 'No items yet — pick from the menu'}
              </div>
            ) : (
              (() => {
                // Group lines by menu so a cross-menu order shows clear
                // section headers (Breakfast / Lunch / …). Single-menu orders
                // skip the header to keep the sidebar tight.
                const groups = new Map<string, { name: string; lines: CartLine[] }>();
                for (const c of cart) {
                  const key = c.menuId || '__none__';
                  if (!groups.has(key)) groups.set(key, { name: c.menuName || '', lines: [] });
                  groups.get(key)!.lines.push(c);
                }
                const showHeaders = groups.size > 1;
                return (
                  <div className="space-y-3">
                    {Array.from(groups.values()).map((g, gi) => (
                      <div key={g.name || `g-${gi}`} className="space-y-2">
                        {showHeaders && g.name && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600 px-1">{g.name}</p>
                        )}
                        {g.lines.map((c) => (
                          <div key={c.cartLineId} className="bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                              {c.variantName && <p className="text-[10px] text-slate-400">{c.variantName}</p>}
                              {c.toppings && c.toppings.length > 0 && (
                                <p className="text-[10px] text-indigo-600 truncate">
                                  {c.toppings.map((t) => t.label).join(' · ')}
                                </p>
                              )}
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                <span className="font-semibold">₹{c.unitPrice.toFixed(2)}</span> × {c.quantity} = <span className="font-bold text-slate-700">₹{(c.unitPrice * c.quantity).toFixed(2)}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => updateQty(c.cartLineId, -1)} className="w-6 h-6 bg-white border border-slate-200 rounded-md flex items-center justify-center"><Minus size={11} /></button>
                              <span className="w-5 text-center text-xs font-bold">{c.quantity}</span>
                              <button onClick={() => updateQty(c.cartLineId, 1)} className="w-6 h-6 bg-brand-500 text-white rounded-md flex items-center justify-center"><Plus size={11} /></button>
                              <button onClick={() => removeLine(c.cartLineId)} className="w-6 h-6 text-slate-400 hover:text-red-500 ml-1"><XIcon size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* Totals + CTA */}
          <div className="px-4 py-3 border-t border-slate-100 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              {taxAmount > 0 && (
                <>
                  <div className="flex justify-between text-slate-500"><span>SGST <span className="text-[10px] text-slate-400">est.</span></span><span>₹{(taxAmount / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-500"><span>CGST <span className="text-[10px] text-slate-400">est.</span></span><span>₹{(taxAmount / 2).toFixed(2)}</span></div>
                </>
              )}
              <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-100">
                <span>Total</span><span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Booking-mode tabs (only Hybrid / Dine-in outlets see Table). */}
            {seatingAllowed && (
              <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1">
                {(['counter','table'] as BookingMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setBookingMode(m)}
                    className={clsx(
                      'text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors',
                      bookingMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {m === 'counter' ? <><Package size={12} /> Counter</> : <><Table2 size={12} /> Table</>}
                  </button>
                ))}
              </div>
            )}

            {bookingMode === 'counter' ? (
              <label className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={isParcel} onChange={e => setIsParcel(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                <Package size={13} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-700">Parcel / takeaway</span>
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                {/* Section pills + table dropdown share a row. Each
                    column holds its own label so the pair stays
                    readable inside the narrow cart sidebar. */}
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Section</label>
                  {visibleTableTypes.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No sections</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {visibleTableTypes.map((tt) => {
                        const active = tt.id === tableTypeId;
                        return (
                          <button
                            key={tt.id}
                            type="button"
                            onClick={() => { setTableTypeId(tt.id); setTableId(''); }}
                            className={clsx(
                              'px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border-[1.5px]',
                              active
                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                            )}
                          >
                            {tt.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Table</label>
                  <select
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                    disabled={!tableTypeId}
                    className="input text-xs w-full"
                  >
                    <option value="">
                      {!tableTypeId ? 'Pick section' : tablesForType.length ? 'Select…' : 'No tables'}
                    </option>
                    {tablesForType.map((t: any) => (
                      <option key={t.id} value={t.id}>Table {t.number} · {t.capacity}p</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Open tabs at this table — only visible on the postpaid
                table flow once a table is picked. Lets the staff pick
                an existing tab to add items / bill, or start a new
                tab without having to remember each customer's phone
                number. */}
            {isPostpaidTableFlow && tableId && (
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-2">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    Open tabs at this table
                    <span className="text-[10px] font-semibold text-slate-400">
                      · {tableOpenTabs.length}
                    </span>
                  </p>
                  <button
                    onClick={startNewTab}
                    title="New tab (different customer)"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-500 hover:text-brand-700 hover:bg-brand-50 border border-slate-200 transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {tableOpenTabs.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-2 text-center">
                    No open tabs yet. Add items below to start one.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {tableOpenTabs.map((tab: any) => {
                      const billed = !!tab.billRequestedAt;
                      const active = openOrder?.id === tab.id;
                      return (
                        <li key={tab.id}>
                          <button
                            onClick={() => selectTab(tab)}
                            className={clsx(
                              'w-full text-left px-2 py-1.5 rounded-lg border transition-colors flex items-center justify-between gap-2',
                              active
                                ? 'bg-brand-50 border-brand-200 text-brand-900'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold flex items-center gap-1.5">
                                <span>#{tab.orderNumber}</span>
                                {billed && (
                                  <span className="text-[9px] font-bold bg-violet-100 text-violet-800 border border-violet-200 px-1 py-0.5 rounded">
                                    Bill requested
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {tab.customer?.name || '—'}
                                {tab.customer?.phone ? ` · ${tab.customer.phone}` : ''}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-slate-700 shrink-0">
                              ₹{Number(tab.totalAmount ?? 0).toFixed(0)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Customer phone — label + input on the same line so the
                postpaid sidebar doesn't sprawl. Hint below in a
                single inline line. */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="customer-phone-input"
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 shrink-0"
              >
                <Phone size={10} /> Phone
              </label>
              <input
                id="customer-phone-input"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+91 ... (optional)"
                className="input text-xs flex-1 min-w-0"
              />
            </div>

            <div className="flex flex-col gap-2">
              {isPostpaidTableFlow ? (
                billingState === 'billing' && openOrder ? (
                  <>
                    <button
                      onClick={() => payBill('CASH')}
                      disabled={placing}
                      className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {placing && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                      <Banknote size={14} /> Cash · ₹{Number(openOrder.totalAmount).toFixed(2)}
                    </button>
                    <button
                      onClick={() => payBill('UPI')}
                      disabled={placing}
                      className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Smartphone size={14} /> UPI · ₹{Number(openOrder.totalAmount).toFixed(2)}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={placePostpaid}
                      disabled={!cart.length || placing || outletClosed || !tableId}
                      className="w-full bg-gradient-to-r from-brand-500 to-brand-700 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {placing && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                      <Plus size={14} /> {openOrder ? 'Add to Order' : 'Place Order'}
                    </button>
                    <button
                      onClick={pressBillNow}
                      disabled={!openOrder || placing}
                      title={!openOrder ? 'Place items first before billing' : undefined}
                      className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Banknote size={14} /> Bill Now{openOrder ? ` · ₹${Number(openOrder.totalAmount).toFixed(2)}` : ''}
                    </button>
                  </>
                )
              ) : (
                <>
                  <button
                    onClick={() => submit('CASH')}
                    disabled={!cart.length || placing || outletClosed || (bookingMode === 'table' && !tableId)}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {placing && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    <Banknote size={14} /> Cash · ₹{totalAmount.toFixed(2)}
                  </button>
                  <button
                    onClick={() => submit('UPI')}
                    disabled={!cart.length || placing || outletClosed || (bookingMode === 'table' && !tableId)}
                    className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Smartphone size={14} /> UPI · ₹{totalAmount.toFixed(2)}
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Item detail modal — variants + toppings + quantity. Replaces the
          plain variant picker so the cashier can compose the same line a
          customer would on the PWA's detail page. */}
      {variantPick && (
        <ItemDetailDialog
          item={variantPick}
          onClose={() => setVariantPick(null)}
          onAdd={(variant, toppings, qty) => {
            addToCart(variantPick, variant, toppings, qty);
            setVariantPick(null);
          }}
        />
      )}
    </div>
  );
}

// ── Item detail dialog ───────────────────────────────────────────
function ItemDetailDialog({
  item, onClose, onAdd,
}: {
  item: any;
  onClose: () => void;
  onAdd: (variant: any | undefined, toppings: CartTopping[], qty: number) => void;
}) {
  const [variantId, setVariantId] = useState<string>(item.variants?.[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  // Topping selection — { selected, optionId? } per link.
  const [topSel, setTopSel] = useState<Record<string, { selected: boolean; optionId?: string }>>(() => {
    const init: Record<string, { selected: boolean; optionId?: string }> = {};
    (item.itemToppings || []).forEach((l: any) => {
      if (l.topping.options?.length) {
        init[l.toppingId] = {
          selected: !!l.isRequired,
          optionId: l.isRequired ? l.topping.options[0].id : undefined,
        };
      } else {
        init[l.toppingId] = { selected: !!l.isRequired };
      }
    });
    return init;
  });

  const variant = item.variants?.find((v: any) => v.id === variantId);
  const basePrice = variant
    ? Number(variant.effectivePrice ?? variant.price)
    : Number(item.effectivePrice ?? item.basePrice);

  // Derive the live toppings list for the price calc + the Add payload.
  const toppings: CartTopping[] = [];
  for (const link of (item.itemToppings || [])) {
    const sel = topSel[link.toppingId];
    if (!sel?.selected && !link.isRequired) continue;
    const linkAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
    if (link.topping.options?.length) {
      const optId = sel?.optionId || link.topping.options[0].id;
      const opt = link.topping.options.find((o: any) => o.id === optId);
      if (!opt) continue;
      toppings.push({
        toppingId: link.toppingId, optionId: opt.id,
        label: `${link.topping.name}: ${opt.name}`,
        priceAdd: linkAdd + Number(opt.priceAdd),
      });
    } else {
      toppings.push({ toppingId: link.toppingId, label: link.topping.name, priceAdd: linkAdd });
    }
  }
  const lineUnit = basePrice + toppings.reduce((s, t) => s + t.priceAdd, 0);
  const lineTotal = lineUnit * qty;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="relative">
          {item.imageUrl || item.thumbnailUrl ? (
            <img src={item.imageUrl || item.thumbnailUrl} alt="" className="w-full aspect-[4/3] object-cover rounded-t-2xl" />
          ) : (
            <div className="w-full aspect-[4/3] rounded-t-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-5xl">🍽️</div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow"
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Body — scrolls when variants + toppings get long */}
        <div className="px-5 pt-4 pb-3 space-y-4 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2">
              <FoodGradeDot grade={item.foodGrade} />
              <h2 className="text-base font-black text-slate-900">{item.name}</h2>
            </div>
            {item.shortDescription && <p className="text-xs text-slate-500 mt-1">{item.shortDescription}</p>}
            {item.longDescription && item.longDescription !== item.shortDescription && (
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.longDescription}</p>
            )}
            <p className="text-sm font-black text-slate-900 mt-2">₹{basePrice.toFixed(0)}</p>
          </div>

          {/* Variants */}
          {item.variants?.length > 0 && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Variant</p>
              <div className="space-y-1.5">
                {item.variants.map((v: any) => {
                  const active = v.id === variantId;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVariantId(v.id)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left',
                        active ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300',
                      )}
                    >
                      <span className={clsx('w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center', active ? 'border-brand-500' : 'border-slate-300')}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">{v.name}</span>
                        {v.shortDescription && <span className="block text-[10px] text-slate-400">{v.shortDescription}</span>}
                      </span>
                      <span className="text-sm font-bold text-slate-900">₹{Number(v.effectivePrice ?? v.price).toFixed(0)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Toppings */}
          {item.itemToppings?.length > 0 && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Add-ons</p>
              <div className="space-y-2">
                {item.itemToppings.map((link: any) => {
                  const sel = topSel[link.toppingId] || { selected: link.isRequired };
                  const linkAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
                  const hasOptions = (link.topping.options?.length || 0) > 0;
                  return (
                    <div key={link.toppingId} className="bg-slate-50 rounded-lg p-2.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!sel.selected}
                          disabled={link.isRequired}
                          onChange={(e) => setTopSel((p) => ({
                            ...p,
                            [link.toppingId]: { selected: e.target.checked, optionId: p[link.toppingId]?.optionId },
                          }))}
                          className="w-4 h-4 accent-brand-500"
                        />
                        <span className="text-xs font-semibold text-slate-800 flex-1">
                          {link.topping.name}
                          {link.isRequired && <span className="ml-1 text-[10px] text-red-500">required</span>}
                        </span>
                        {!hasOptions && <span className="text-xs font-bold text-slate-700">+₹{linkAdd.toFixed(0)}</span>}
                      </label>
                      {hasOptions && sel.selected && (
                        <div className="mt-2 ml-6 space-y-1">
                          {link.topping.options.map((opt: any) => (
                            <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`top-${link.toppingId}`}
                                checked={sel.optionId === opt.id}
                                onChange={() => setTopSel((p) => ({ ...p, [link.toppingId]: { selected: true, optionId: opt.id } }))}
                                className="accent-brand-500"
                              />
                              <span className="text-[11px] text-slate-700 flex-1">{opt.name}</span>
                              <span className="text-[11px] font-semibold text-slate-700">+₹{(linkAdd + Number(opt.priceAdd)).toFixed(0)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Sticky footer: qty + Add */}
        <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Minus size={13} />
            </button>
            <span className="text-sm font-bold w-8 text-center">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Plus size={13} />
            </button>
          </div>
          <button
            onClick={() => onAdd(variant, toppings, qty)}
            className="flex-1 bg-gold-500 hover:bg-gold-600 text-charcoal-900  text-white font-bold py-2.5 rounded-xl text-sm"
          >
            Add {qty} for ₹{lineTotal.toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  );
}
