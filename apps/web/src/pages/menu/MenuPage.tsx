import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Plus, Eye, EyeOff, ChevronRight, ChevronDown, ChevronUp, ChevronLeft,
  UtensilsCrossed, Star, Edit2, Trash2, Tag, ImagePlus, X as XIcon,
  Store, Download, IndianRupee, QrCode, PackagePlus,
  Clock, Layers, CheckCircle2, XCircle,
} from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import { useUserRole } from '../../hooks/useUserRole';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { downloadQrCard } from '../../utils/qrCard';

/* ── helpers ─────────────────────────────────────────────── */
const FOOD_GRADE_COLOR: Record<string, string> = {
  VEG:     '#16a34a',
  NON_VEG: '#dc2626',
  VEGAN:   '#0d9488',
};
const FoodGradeDot = ({ grade }: { grade?: string }) => {
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
};

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

async function fileToDataUrl(file: File, maxSize = 800, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Invalid image'));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/* ── main component ───────────────────────────────────────── */
export default function MenuPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier } = useUserRole();
  const isReadOnly = tier === 'counter';
  const isTemplate = tier === 'business';
  const businessId = user?.businessId;
  const userOutletId = user?.outletId || '';

  // Outlets for selector — only meaningful at outlet tier (and platform). At
  // business tier we manage one template menu, not per-outlet menus.
  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletId, setOutletId] = useState<string>(userOutletId);
  const currentOutlet = outlets.find(o => o.id === outletId);
  // CRUD calls hit either the outlet menu or the business template menu.
  const menuBase = isTemplate
    ? `/businesses/${businessId}/menu`
    : `/outlets/${outletId}/menu`;
  const [importBusinessOpen, setImportBusinessOpen] = useState(false);
  const [importBusinessSummary, setImportBusinessSummary] = useState<any>(null);
  const [importBusinessBusy, setImportBusinessBusy] = useState(false);
  // Holds the business template tree (with `alreadyImported` per item) plus
  // the user's per-item selection while the import modal is open.
  const [businessTemplate, setBusinessTemplate] = useState<any[] | null>(null);
  // Selection at three levels — a row at any level marks itself (and, by
  // cascade, everything beneath it) for import. Cascading is computed at
  // render/submit time from these three sets, not stored explicitly.
  const [importPickCats, setImportPickCats] = useState<Set<string>>(new Set());
  const [importPickSubs, setImportPickSubs] = useState<Set<string>>(new Set());
  const [importPickItems, setImportPickItems] = useState<Set<string>>(new Set());
  const [importTreeLoading, setImportTreeLoading] = useState(false);

  const customerOrigin = (window as any).VITE_CUSTOMER_URL
    || window.location.origin.replace(':5173', ':5174');

  const downloadMenuQr = (
    target: 'category' | 'subcategory' | 'item',
    id: string,
    name: string,
  ) => {
    const params =
      target === 'category' ? `&category=${id}` :
      target === 'subcategory' ? `&sub=${id}` :
      '';
    // Item QRs route through the canonical /s/outlet/<outletId>/item/<itemId>
    // scan resolver — it handles auth (stashes target + sends to /auth when
    // not logged in), cluster routing, and finally lands the customer on
    // /order?outlet=…&item=<id> so OrderPage pops the detail sheet over the
    // outlet menu. The old /order/item/<id> path is retired and would drop
    // both the id and the ?outlet= query through the legacy redirect.
    const url = target === 'item'
      ? `${customerOrigin}/s/outlet/${outletId}/item/${id}`
      : `${customerOrigin}/order?outlet=${outletId}${params}`;
    return downloadQrCard({
      outletName: currentOutlet?.name,
      outletAddress: currentOutlet?.address,
      caption: target === 'item' ? 'Scan for this item' : `Scan for ${target}`,
      label: target.toUpperCase(),
      detail: name,
      url,
      filename: `qr-${currentOutlet?.name || 'outlet'}-${target}-${name}.png`,
    });
  };

  const [categories, setCategories] = useState<any[]>([]);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);

  // ── Multiple-menus feature ─────────────────────────────
  // `menus` is the business's menu list (always at least 1 — the default
  // "Main Menu" auto-seeded at business creation). `multipleMenusEnabled`
  // gates the tab strip; when false we keep the single menu implicit and
  // never show menu chrome. Menu modals (create / timings) are gated below.
  type TimingSlot = { id?: string; dayOfWeek: number; startMinute: number; endMinute: number };
  type MenuRow = {
    id: string; name: string; isDefault: boolean; isActive: boolean;
    timingSlots: TimingSlot[];
    // Outlet-side state — only present when fetched via /outlets/:id/menus.
    // overrideTimings=true means the slots in outletMenu.timingSlots take
    // precedence over the business-level timingSlots above.
    outletMenu?: { id: string | null; isEnabled: boolean; overrideTimings: boolean; timingSlots: TimingSlot[] };
  };
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [multipleMenusEnabled, setMultipleMenusEnabled] = useState(false);
  // Business identity for the page header — populated alongside the menu
  // fetch so the header carries the brand context (logo + name) instead of
  // a generic "Menu Management" title.
  const [business, setBusiness] = useState<{ name?: string; logoUrl?: string | null } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string>('');
  const [menuModal, setMenuModal] = useState<{ open: boolean; editing?: MenuRow }>({ open: false });
  const [timingsModal, setTimingsModal] = useState<{ open: boolean; menu?: MenuRow }>({ open: false });
  const [menuBusy, setMenuBusy] = useState(false);

  // modal state
  const [catModal, setCatModal]     = useState<{ open: boolean; editing?: any }>({ open: false });
  const [subModal, setSubModal]     = useState<{ open: boolean; categoryId?: string; editing?: any }>({ open: false });
  const [itemModal, setItemModal]   = useState<{ open: boolean; subcategoryId?: string; editing?: any }>({ open: false });
  const [itemImage, setItemImage]   = useState<string | null>(null);
  const [thumbnail, setThumbnail]   = useState<string | null>(null);
  const [gallery, setGallery]       = useState<{ id?: string; url: string; isNew?: boolean }[]>([]);
  const [subImage, setSubImage]     = useState<string | null>(null);
  // Item modal — variant editor draft. id=undefined for new rows.
  // unitQuantity is the numeric portion size (e.g. 250 for "250g") when
  // the parent Item is sold by weight / volume. Null for count-based
  // items where each variant is just a named size.
  const [variantsDraft, setVariantsDraft] = useState<{ id?: string; name: string; shortDescription: string; price: string; unitQuantity?: string; _delete?: boolean }[]>([]);
  // Item-level quantity unit. NUMBER (default) keeps the existing
  // free-text variant editor; GRAMS / MILLILITERS swaps in the
  // numeric-portion input below and auto-formats variant names.
  const [itemQuantityUnit, setItemQuantityUnit] = useState<'NUMBER' | 'GRAMS' | 'MILLILITERS'>('NUMBER');
  const fileInputRef                = useRef<HTMLInputElement>(null);
  const thumbInputRef               = useRef<HTMLInputElement>(null);
  const galleryInputRef             = useRef<HTMLInputElement>(null);
  const subImageRef                 = useRef<HTMLInputElement>(null);
  const [varModal, setVarModal]     = useState<{ open: boolean; itemId?: string }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [saving, setSaving]         = useState(false);

  // Tag + table-type pricing
  const [customerTags, setCustomerTags] = useState<any[]>([]);
  const [tableTypesList, setTableTypesList] = useState<any[]>([]);
  const [tagPriceModal, setTagPriceModal] = useState<{ open: boolean; item?: any }>({ open: false });
  // draft keys: `tag:<tagId>:<variantId>` or `tt:<typeId>:<variantId>`
  // Each cell tracks price + GST % shown for this (tag/table, variant). The
  // `inheritedGst` is the item-level default we pre-filled the field with —
  // we compare against it on save to decide whether the user actually wants
  // an override or just left the inherited value as-is.
  type PriceCellDraft = { price: string; gstRate: string; inheritedGst: string };
  const [tagPriceDraft, setTagPriceDraft] = useState<Record<string, PriceCellDraft>>({});

  // Toppings catalog (outlet-level) and item-level selection draft
  const [outletToppings, setOutletToppings] = useState<any[]>([]);
  const [itemToppingDraft, setItemToppingDraft] = useState<Record<string, { selected: boolean; priceAdd: string; isRequired: boolean }>>({});

  // Bundle draft state — only meaningful when the item is flagged isBundle.
  // Each row is one child item with optional variant + quantity.
  type BundleChildDraft = { childItemId: string; variantId: string | null; quantity: number };
  const [isBundleDraft, setIsBundleDraft] = useState(false);
  const [bundleChildrenDraft, setBundleChildrenDraft] = useState<BundleChildDraft[]>([]);
  // Customer-choice cap. 0 = legacy "everything included"; >0 = customer
  // must pick exactly N child rows at order time.
  const [maxBundleSelectionsDraft, setMaxBundleSelectionsDraft] = useState<number>(0);

  // Tag-price draft now keyed by `${tagId}:${variantId|''}`
  const tagPriceKey = (tagId: string, variantId: string) => `${tagId}:${variantId}`;

  // Fetch business outlets (for selector + import source)
  useEffect(() => {
    if (!businessId) return;
    api.get(`/outlets/business/${businessId}`)
      .then(({ data }) => {
        const list = data.data || [];
        setOutlets(list);
        if (!outletId && list.length) setOutletId(list[0].id);
      })
      .catch(() => {});
  }, [businessId]);

  // Keep outletId pinned to the user's assigned outlet for tiers that can't
  // switch outlets. Prevents a stale dropdown selection (eg. from a prior
  // session in the same tab) from retargeting imports / edits.
  useEffect(() => {
    if (tier !== 'platform' && tier !== 'business' && user?.outletId && outletId !== user.outletId) {
      setOutletId(user.outletId);
    }
  }, [tier, user?.outletId, outletId]);

  const fetchMenu = useCallback(async () => {
    if (isTemplate) {
      if (!businessId) { setLoading(false); return; }
      setLoading(true);
      try {
        const [menuRes, bizRes, menusRes] = await Promise.all([
          api.get(`/businesses/${businessId}/menu`),
          api.get(`/businesses/${businessId}`).catch(() => null),
          api.get(`/businesses/${businessId}/menus`).catch(() => null),
        ]);
        setCategories(menuRes.data.data);
        setCustomerTags([]); setOutletToppings([]); setTableTypesList([]);
        if (bizRes) {
          const b = bizRes.data.data || {};
          setMultipleMenusEnabled(!!b.multipleMenusEnabled);
          setBusiness({ name: b.name, logoUrl: b.logoUrl });
        }
        const list: MenuRow[] = menusRes?.data?.data || [];
        setMenus(list);
        // Land on the previously-selected menu if it's still present,
        // otherwise pick the first.
        setActiveMenuId((prev) => (list.find((m) => m.id === prev) ? prev : list[0]?.id || ''));
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!outletId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [menuRes, tagsRes, topsRes, ttRes, outletMenusRes] = await Promise.all([
        api.get(`/outlets/${outletId}/menu`, { params: { includeHidden: 'true' } }),
        api.get(`/outlets/${outletId}/customer-tags`),
        api.get(`/outlets/${outletId}/toppings`),
        api.get(`/outlets/${outletId}/table-types`).catch(() => ({ data: { data: [] } })),
        api.get(`/outlets/${outletId}/menus`).catch(() => null),
      ]);
      setCategories(menuRes.data.data);
      setCustomerTags(tagsRes.data.data || []);
      setOutletToppings(topsRes.data.data || []);
      setTableTypesList(ttRes.data.data || []);
      // Outlet admin needs to see ALL menus (including disabled ones) so they
      // can re-enable them — only the customer-facing menu list filters by
      // isEnabled. Disabled tabs render dimmed in the strip.
      const list: MenuRow[] = (outletMenusRes?.data?.data || []) as MenuRow[];
      setMenus(list);
      setActiveMenuId((prev) => (list.find((m) => m.id === prev) ? prev : list[0]?.id || ''));
      // Read the outlet-level multi-menu flag. This is independent of the
      // business flag — outlet admins flip their own switch.
      try {
        const { data } = await api.get(`/outlets/${outletId}`);
        setMultipleMenusEnabled(!!data.data?.multipleMenusEnabled);
      } catch {
        setMultipleMenusEnabled(false);
      }
    } finally {
      setLoading(false);
    }
  }, [outletId, businessId, isTemplate]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // Map item.id → menuId so the price-override modal can hide sections that
  // have this item's menu disabled (no point pricing items a section won't show).
  const itemMenuById = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const cat of categories) {
      for (const sub of cat.subcategories || []) {
        for (const it of sub.items || []) m.set(it.id, cat.menuId);
      }
    }
    return m;
  }, [categories]);

  // ── Price overrides: customer tags + table types ────────
  // Draft keys: `tag:<tagId>:<variantId>` or `tt:<typeId>:<variantId>` (variantId='' for item-level)
  const openTagPrices = (item: any) => {
    const draft: Record<string, PriceCellDraft> = {};
    // Pre-fill GST cells with the item's default (or outlet default) so the
    // user sees the rate that would apply. They can override per cell.
    const inheritedGst =
      item?.gstRate != null
        ? Number(item.gstRate)
        : currentOutlet?.gstApplicable
          ? Number(currentOutlet.gstPercent || 0)
          : null;
    const inheritedGstStr = inheritedGst != null ? String(inheritedGst) : '';
    const cell = (price: any, gst: any): PriceCellDraft => ({
      price: price != null ? String(price) : '',
      gstRate: gst != null ? String(gst) : inheritedGstStr,
      inheritedGst: inheritedGstStr,
    });
    // Customer tag overrides
    customerTags.forEach(t => {
      const itemOv = item.customerTagPrices?.find((p: any) => p.customerTagId === t.id && !p.variantId);
      draft[`tag:${t.id}:`] = cell(itemOv?.price, itemOv?.gstRate);
      (item.variants || []).forEach((v: any) => {
        const vOv = item.customerTagPrices?.find((p: any) => p.customerTagId === t.id && p.variantId === v.id);
        draft[`tag:${t.id}:${v.id}`] = cell(vOv?.price, vOv?.gstRate);
      });
    });
    // Table-type overrides
    tableTypesList.forEach(tt => {
      const itemOv = item.tableTypePrices?.find((p: any) => p.tableTypeId === tt.id && !p.variantId);
      draft[`tt:${tt.id}:`] = cell(itemOv?.price, itemOv?.gstRate);
      (item.variants || []).forEach((v: any) => {
        const vOv = item.tableTypePrices?.find((p: any) => p.tableTypeId === tt.id && p.variantId === v.id);
        draft[`tt:${tt.id}:${v.id}`] = cell(vOv?.price, vOv?.gstRate);
      });
    });
    setTagPriceDraft(draft);
    setTagPriceModal({ open: true, item });
  };

  const savePriceCell = async (
    kind: 'tag' | 'tt',
    id: string,
    variantId: string,
    cell: PriceCellDraft,
  ) => {
    const item = tagPriceModal.item;
    if (!item) return;
    const price = cell.price.trim();
    const gst = cell.gstRate.trim();
    const gstDiffersFromDefault = gst !== cell.inheritedGst;
    const base = kind === 'tag'
      ? `/outlets/${outletId}/customer-tags/${id}/prices/${item.id}`
      : `/outlets/${outletId}/table-types/${id}/prices/${item.id}`;
    const url = variantId ? `${base}?variantId=${variantId}` : base;
    try {
      // No explicit price AND no GST change → user didn't touch this cell;
      // drop any stored override so the item inherits.
      if (price === '' && !gstDiffersFromDefault) {
        await api.delete(url);
        return;
      }
      const num = price === '' ? Number(item.basePrice) : Number(price);
      if (!Number.isFinite(num) || num < 0) {
        toast.error('Enter a valid non-negative price');
        return;
      }
      // Only persist gstRate if it actually differs from the inherited default,
      // otherwise null = inherit, so the item GST flows through later changes.
      const gstNum = !gstDiffersFromDefault || gst === '' ? null : Number(gst);
      if (gstNum != null && (!Number.isFinite(gstNum) || gstNum < 0 || gstNum > 100)) {
        toast.error('GST must be between 0 and 100');
        return;
      }
      await api.put(url, { price: num, gstRate: gstNum });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const saveAllTagPrices = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(tagPriceDraft).map(([key, cell]) => {
          const [kind, id, variantId] = key.split(':');
          return savePriceCell(kind as 'tag' | 'tt', id, variantId, cell);
        }),
      );
      toast.success('Price overrides updated');
      setTagPriceModal({ open: false });
      fetchMenu();
    } finally {
      setSaving(false);
    }
  };

  // Sync subcategory image preview on open
  useEffect(() => {
    if (subModal.open) {
      setSubImage(subModal.editing?.imageUrl || null);
    }
  }, [subModal.open, subModal.editing]);

  // sync image previews + gallery + topping draft with item modal open/edit
  useEffect(() => {
    if (itemModal.open) {
      setItemImage(itemModal.editing?.imageUrl || null);
      setThumbnail(itemModal.editing?.thumbnailUrl || null);
      setGallery((itemModal.editing?.images || []).map((g: any) => ({ id: g.id, url: g.url })));
      setVariantsDraft(
        (itemModal.editing?.variants || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          shortDescription: v.shortDescription || '',
          price: String(v.price),
          unitQuantity: v.unitQuantity != null ? String(v.unitQuantity) : '',
        })),
      );
      setItemQuantityUnit(
        (itemModal.editing?.quantityUnit as any) || 'NUMBER',
      );

      const existing: Record<string, { selected: boolean; priceAdd: string; isRequired: boolean }> = {};
      (itemModal.editing?.itemToppings || []).forEach((l: any) => {
        existing[l.toppingId] = {
          selected: true,
          priceAdd: l.priceAdd != null ? String(l.priceAdd) : '',
          isRequired: !!l.isRequired,
        };
      });
      setItemToppingDraft(existing);

      setIsBundleDraft(!!itemModal.editing?.isBundle);
      setBundleChildrenDraft(
        (itemModal.editing?.bundleChildren || []).map((c: any) => ({
          childItemId: c.childItemId,
          variantId: c.variantId || null,
          quantity: Number(c.quantity ?? 1),
        })),
      );
      setMaxBundleSelectionsDraft(Number(itemModal.editing?.maxBundleSelections ?? 0));
    }
  }, [itemModal.open, itemModal.editing]);

  const pickImageFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    opts: { maxSize?: number; quality?: number; sizeLimitKB?: number },
  ): Promise<string | null> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return null;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG or WebP images are allowed');
      return null;
    }
    const limit = (opts.sizeLimitKB ?? 1024) * 1024;
    if (file.size > limit) {
      toast.error(`Image is larger than ${(opts.sizeLimitKB ?? 1024)} KB`);
      return null;
    }
    try {
      return await fileToDataUrl(file, opts.maxSize, opts.quality);
    } catch {
      toast.error('Could not read that image');
      return null;
    }
  };

  const onPickImage     = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = await pickImageFile(e, { maxSize: 800, quality: 0.82, sizeLimitKB: 1024 });
    if (url) setItemImage(url);
  };
  const onPickThumbnail = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = await pickImageFile(e, { maxSize: 320, quality: 0.8, sizeLimitKB: 300 });
    if (url) setThumbnail(url);
  };
  const onPickGallery   = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = await pickImageFile(e, { maxSize: 1000, quality: 0.82, sizeLimitKB: 1024 });
    if (url) setGallery(prev => [...prev, { url, isNew: true }]);
  };
  const onPickSubImage  = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = await pickImageFile(e, { maxSize: 320, quality: 0.8, sizeLimitKB: 300 });
    if (url) setSubImage(url);
  };

  const toggleExpand = (id: string) =>
    setExpanded(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ── Category CRUD ────────────────────────────────────────
  const saveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    // Stamp the new category with the active menu so it lands inside the
    // selected tab. Edit doesn't move categories between menus — that's a
    // separate operation if we add it later.
    const body: any = { name: form.get('name') as string };
    if (!catModal.editing && activeMenuId) body.menuId = activeMenuId;
    setSaving(true);
    try {
      if (catModal.editing) {
        await api.patch(`${menuBase}/categories/${catModal.editing.id}`, body);
        toast.success('Category updated');
      } else {
        await api.post(`${menuBase}/categories`, body);
        toast.success('Category created');
      }
      setCatModal({ open: false });
      fetchMenu();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Menu CRUD + timings ─────────────────────────────────
  // Business tier creates the menu directly on the business; outlet tier
  // routes through /outlets/:id/menus which also auto-enables the new menu
  // at the calling outlet (so the new tab is usable immediately).
  const saveMenu = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: (form.get('name') as string || '').trim(),
      description: (form.get('description') as string || '').trim() || undefined,
      isActive: form.get('isActive') === 'on',
    };
    if (!body.name) { toast.error('Menu name is required'); return; }
    setMenuBusy(true);
    try {
      if (menuModal.editing) {
        await api.patch(`/menus/${menuModal.editing.id}`, body);
        toast.success('Menu updated');
      } else {
        const url = isTemplate
          ? `/businesses/${businessId}/menus`
          : `/outlets/${outletId}/menus`;
        if (isTemplate && !businessId) return;
        if (!isTemplate && !outletId) return;
        const { data } = await api.post(url, body);
        setActiveMenuId(data.data.id);
        toast.success('Menu created');
      }
      setMenuModal({ open: false });
      fetchMenu();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setMenuBusy(false); }
  };

  const deleteMenu = async (menu: MenuRow) => {
    if (menu.isDefault) { toast.error('Default menu cannot be deleted'); return; }
    if (!confirm(`Delete menu "${menu.name}"? Categories must be moved or removed first.`)) return;
    try {
      await api.delete(`/menus/${menu.id}`);
      toast.success('Menu deleted');
      if (activeMenuId === menu.id) setActiveMenuId('');
      fetchMenu();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to delete menu'); }
  };

  // Persist the flag and refetch so tab visibility flips. Business tier
  // writes Business.multipleMenusEnabled (gates the management UI); outlet
  // tier writes Outlet.multipleMenusEnabled (gates the customer-facing
  // surface and outlet-side admin UI).
  const toggleMultipleMenus = async (next: boolean) => {
    setMultipleMenusEnabled(next); // optimistic
    try {
      if (isTemplate) {
        if (!businessId) return;
        await api.patch(`/businesses/${businessId}`, { multipleMenusEnabled: next });
      } else {
        if (!outletId) return;
        await api.patch(`/outlets/${outletId}`, { multipleMenusEnabled: next });
      }
      // Refetch so the menu list collapses/expands accordingly.
      fetchMenu();
    } catch (e: any) {
      setMultipleMenusEnabled(!next);
      toast.error(e.response?.data?.message || 'Failed to update setting');
    }
  };

  // ── Outlet-tier menu actions (enable/disable, import) ────
  const toggleOutletMenu = async (menu: MenuRow, next: boolean) => {
    if (!outletId) return;
    // Optimistic flip of isEnabled — refetch settles any drift.
    setMenus((all) => all.map((m) => (m.id === menu.id
      ? { ...m, outletMenu: { ...(m.outletMenu || { id: null, overrideTimings: false, timingSlots: [] }), isEnabled: next } }
      : m)));
    try {
      await api.patch(`/outlets/${outletId}/menus/${menu.id}`, { isEnabled: next });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update');
      fetchMenu();
    }
  };

  // (importMenuItems removed — wholesale per-menu auto-import was misleading.
  //  Outlets now import explicitly via the "Import from Business" dialog and
  //  pick which categories / subcategories / items they want.)

  // ── Subcategory CRUD ─────────────────────────────────────
  const saveSubcategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = { name: form.get('name') as string, imageUrl: subImage };
    setSaving(true);
    try {
      if (subModal.editing) {
        await api.patch(`${menuBase}/subcategories/${subModal.editing.id}`, body);
        toast.success('Subcategory updated');
      } else {
        await api.post(`${menuBase}/categories/${subModal.categoryId}/subcategories`, body);
        toast.success('Subcategory added');
      }
      setSubModal({ open: false });
      fetchMenu();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Item CRUD ────────────────────────────────────────────
  const saveItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name') as string,
      shortDescription: (form.get('shortDescription') as string || '').slice(0, 50) || undefined,
      longDescription: (form.get('longDescription') as string || '').slice(0, 250) || undefined,
      foodGrade: (form.get('foodGrade') as string) || 'VEG',
      basePrice: Number(form.get('basePrice')),
      gstRate:
        form.get('gstRate') !== null && (form.get('gstRate') as string).trim() !== ''
          ? Number(form.get('gstRate'))
          : null,
      parcelAvailable: form.get('parcelAvailable') === 'on',
      useCustomParcelCharge: form.get('useCustomParcelCharge') === 'on',
      parcelCharge: form.get('parcelCharge') ? Number(form.get('parcelCharge')) : undefined,
      preparationTime: form.get('preparationTime') ? Number(form.get('preparationTime')) : undefined,
      isPopular: form.get('isPopular') === 'on',
      isSpecial: form.get('isSpecial') === 'on',
      // Sales unit — NUMBER keeps existing count-based behaviour;
      // GRAMS / MILLILITERS marks the item as portion-based, drives
      // variant naming, and is hinted on the customer UI.
      quantityUnit: itemQuantityUnit === 'NUMBER' ? null : itemQuantityUnit,
      // Visibility on the customer menu. Off = item exists, can be sold
      // inside a bundle, but doesn't show in the public category listing.
      isDisplayed: form.get('isDisplayed') === 'on',
      // Limited-stock toggle: when enabled, availableQuantity drives auto-disable
      // once stock hits zero. Initial quantity is captured on create; subsequent
      // top-ups go through the dedicated "Add stock" PATCH (see addStock below).
      hasLimitedStock: form.get('hasLimitedStock') === 'on',
      availableQuantity: form.get('hasLimitedStock') === 'on'
        ? Math.max(0, Number(form.get('availableQuantity') || 0))
        : 0,
      imageUrl: itemImage,
      thumbnailUrl: thumbnail,
      // Bundle composition. When the item is flagged isBundle the server
      // expands the children into individual prep tickets at order time.
      // An empty children array clears any prior composition.
      isBundle: isBundleDraft,
      bundleChildren: isBundleDraft
        ? bundleChildrenDraft
            .filter((c) => c.childItemId)
            .map((c) => ({
              childItemId: c.childItemId,
              variantId: c.variantId || null,
              quantity: Math.max(1, Number(c.quantity) || 1),
            }))
        : [],
      // Customer-choice cap. Saved only when the bundle is on AND a positive
      // value is set; otherwise sent as null to clear any prior config.
      maxBundleSelections: isBundleDraft && maxBundleSelectionsDraft > 0
        ? maxBundleSelectionsDraft
        : null,
    };
    if (isBundleDraft && maxBundleSelectionsDraft > 0) {
      const componentCount = bundleChildrenDraft.filter((c) => c.childItemId).length;
      if (maxBundleSelectionsDraft > componentCount) {
        toast.error(`"Customer picks N" can't exceed the ${componentCount} component${componentCount === 1 ? '' : 's'} you've added`);
        return;
      }
    }
    setSaving(true);
    try {
      let itemId: string;
      if (itemModal.editing) {
        await api.patch(`${menuBase}/items/${itemModal.editing.id}`, body);
        itemId = itemModal.editing.id;
        toast.success('Item updated');
      } else {
        const { data } = await api.post(`${menuBase}/subcategories/${itemModal.subcategoryId}/items`, body);
        itemId = data.data.id;
        toast.success('Item created');
      }

      // Sync gallery: delete removed, add new
      const existingIds = new Set(
        (itemModal.editing?.images || []).map((g: any) => g.id) as string[],
      );
      const keptIds = new Set(gallery.filter(g => g.id).map(g => g.id as string));
      const removed = [...existingIds].filter(id => !keptIds.has(id));
      const additions = gallery.filter(g => g.isNew);

      await Promise.all([
        ...removed.map(id =>
          api.delete(`${menuBase}/items/${itemId}/images/${id}`),
        ),
        ...additions.map(g =>
          api.post(`${menuBase}/items/${itemId}/images`, { url: g.url }),
        ),
      ]);

      // Sync variants — delete removed, update existing, create new
      const removedVariantIds = (itemModal.editing?.variants || [])
        .filter((v: any) => !variantsDraft.some(d => d.id === v.id))
        .map((v: any) => v.id as string);
      await Promise.all([
        ...removedVariantIds.map((vid: string) =>
          api.delete(`${menuBase}/variants/${vid}`),
        ),
        ...variantsDraft
          .filter(d => {
            // For portion-based items, the row is valid when the
            // numeric size is positive and a price is set; the name
            // is auto-formatted. For count-based items the existing
            // name + price rule applies.
            if (itemQuantityUnit !== 'NUMBER') {
              const q = Number(d.unitQuantity || 0);
              return q > 0 && d.price !== '';
            }
            return d.name.trim() && d.price !== '';
          })
          .map(d => {
            const unitSuffix = itemQuantityUnit === 'GRAMS' ? 'g'
              : itemQuantityUnit === 'MILLILITERS' ? 'ml'
              : '';
            const payload: any = {
              name: itemQuantityUnit !== 'NUMBER' && d.unitQuantity
                ? `${d.unitQuantity}${unitSuffix}`
                : d.name.trim(),
              shortDescription: d.shortDescription.trim() || undefined,
              price: Number(d.price),
              unitQuantity: itemQuantityUnit !== 'NUMBER' && d.unitQuantity
                ? Math.max(1, Number(d.unitQuantity))
                : null,
            };
            return d.id
              ? api.patch(`${menuBase}/variants/${d.id}`, payload)
              : api.post(`${menuBase}/items/${itemId}/variants`, payload);
          }),
      ]);

      // Sync topping links — outlet-scoped only. In Business Menu (Template)
      // mode there is no outletId, and toppings live on the outlet (not on
      // the business template), so skip the PUT entirely. Items imported
      // from the template into an outlet get their toppings attached there.
      if (!isTemplate && outletId) {
        const links = Object.entries(itemToppingDraft)
          .filter(([, v]) => v.selected)
          .map(([toppingId, v]) => ({
            toppingId,
            priceAdd: v.priceAdd === '' ? undefined : Number(v.priceAdd),
            isRequired: v.isRequired,
          }));
        await api.put(`/outlets/${outletId}/toppings/item/${itemId}`, { links });
      }

      setItemModal({ open: false });
      fetchMenu();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Variant CRUD ─────────────────────────────────────────
  const saveVariant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name') as string,
      shortDescription: (form.get('shortDescription') as string || '').slice(0, 80) || undefined,
      price: Number(form.get('price')),
    };
    setSaving(true);
    try {
      await api.post(`${menuBase}/items/${varModal.itemId}/variants`, body);
      toast.success('Variant added');
      setVarModal({ open: false });
      fetchMenu();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Toggle availability ──────────────────────────────────
  const toggleAvailability = async (itemId: string) => {
    await api.patch(`${menuBase}/items/${itemId}/availability`);
    fetchMenu();
    toast.success('Availability updated');
  };

  // ── Toggle visibility on customer menu ───────────────────
  // Hidden items can still be ordered as part of a bundle (e.g. a mini-dosa
  // that's only sold inside a combo) — they just don't appear in the
  // customer-facing category listing.
  const toggleVisibility = async (itemId: string) => {
    await api.patch(`${menuBase}/items/${itemId}/visibility`);
    fetchMenu();
    toast.success('Visibility updated');
  };

  // ── Add stock (limited-stock items only) ─────────────────
  // Prompts staff for a positive integer and increments the item's current
  // stock by that amount. The backend auto-flips isAvailable back to true
  // once the count is > 0.
  const addStock = async (item: any) => {
    const raw = window.prompt(`Add stock to "${item.name}". How many to add?`, '10');
    if (raw == null) return;
    const qty = Math.floor(Number(raw));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Enter a whole number greater than 0');
      return;
    }
    try {
      await api.patch(`${menuBase}/items/${item.id}/stock`, { addQuantity: qty });
      toast.success(`Added ${qty} to stock`);
      fetchMenu();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to add stock');
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      if (deleteTarget.type === 'category')    await api.delete(`${menuBase}/categories/${deleteTarget.id}`);
      if (deleteTarget.type === 'item')        await api.delete(`${menuBase}/items/${deleteTarget.id}`);
      if (deleteTarget.type === 'variant')     await api.delete(`${menuBase}/variants/${deleteTarget.id}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      fetchMenu();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  /* ── Reorder helpers ──────────────────────────────────────
     Each reorder is an optimistic local swap followed by a PATCH that writes
     displayOrder = array index on the affected rows. Backend scopes the write
     to the caller's tier (business template rows vs outlet-owned rows), so
     business and outlet hold independent orderings of the same logical menu.
  */
  const swap = <T,>(arr: T[], i: number, j: number): T[] => {
    if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return arr;
    const out = arr.slice();
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  };
  const menusBase = isTemplate
    ? `/businesses/${businessId}/menus`
    : `/outlets/${outletId}/menus`;

  const moveMenu = async (menuId: string, dir: -1 | 1) => {
    const i = menus.findIndex((m) => m.id === menuId);
    if (i < 0) return;
    const reordered = swap(menus, i, i + dir);
    if (reordered === menus) return;
    setMenus(reordered);
    try {
      await api.patch(`${menusBase}/reorder`, { orderedIds: reordered.map((m) => m.id) });
    } catch (e: any) {
      setMenus(menus); // rollback
      toast.error(e?.response?.data?.message || 'Reorder failed');
    }
  };

  // Current category filter window — mirrors the render-time filter so the
  // ids sent to the server match what the user sees.
  const visibleCategories = () =>
    categories.filter((cat) => !multipleMenusEnabled || !activeMenuId || cat.menuId === activeMenuId);

  const moveCategory = async (categoryId: string, dir: -1 | 1) => {
    const visible = visibleCategories();
    const vi = visible.findIndex((c) => c.id === categoryId);
    if (vi < 0) return;
    const newVisible = swap(visible, vi, vi + dir);
    if (newVisible === visible) return;
    // Re-stitch into the full array: each "visible slot" in the original
    // categories list takes the next id from newVisible in order.
    const queue = newVisible.slice();
    const prev = categories;
    const nextCats = categories.map((c) =>
      visible.some((v) => v.id === c.id) ? (queue.shift() as any) : c,
    );
    setCategories(nextCats);
    try {
      await api.patch(`${menuBase}/categories/reorder`, {
        orderedIds: newVisible.map((c) => c.id),
      });
    } catch (e: any) {
      setCategories(prev);
      toast.error(e?.response?.data?.message || 'Reorder failed');
    }
  };

  const moveSubcategory = async (categoryId: string, subcategoryId: string, dir: -1 | 1) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const subs = (cat.subcategories || []) as any[];
    const i = subs.findIndex((s) => s.id === subcategoryId);
    if (i < 0) return;
    const newSubs = swap(subs, i, i + dir);
    if (newSubs === subs) return;
    const prev = categories;
    setCategories((all) => all.map((c) => (c.id === categoryId ? { ...c, subcategories: newSubs } : c)));
    try {
      await api.patch(`${menuBase}/categories/${categoryId}/subcategories/reorder`, {
        orderedIds: newSubs.map((s) => s.id),
      });
    } catch (e: any) {
      setCategories(prev);
      toast.error(e?.response?.data?.message || 'Reorder failed');
    }
  };

  const moveItem = async (categoryId: string, subcategoryId: string, itemId: string, dir: -1 | 1) => {
    const cat = categories.find((c) => c.id === categoryId);
    const sub = cat?.subcategories?.find((s: any) => s.id === subcategoryId);
    if (!sub) return;
    const items = (sub.items || []) as any[];
    const i = items.findIndex((it) => it.id === itemId);
    if (i < 0) return;
    const newItems = swap(items, i, i + dir);
    if (newItems === items) return;
    const prev = categories;
    setCategories((all) => all.map((c) => (c.id === categoryId
      ? { ...c, subcategories: c.subcategories.map((s: any) => (s.id === subcategoryId ? { ...s, items: newItems } : s)) }
      : c)));
    try {
      await api.patch(`${menuBase}/subcategories/${subcategoryId}/items/reorder`, {
        orderedIds: newItems.map((it) => it.id),
      });
    } catch (e: any) {
      setCategories(prev);
      toast.error(e?.response?.data?.message || 'Reorder failed');
    }
  };

  const totalItems = categories.reduce((s, c) =>
    s + c.subcategories?.reduce((ss: number, sc: any) => ss + (sc.items?.length || 0), 0), 0);

  const isMultiOutlet = outlets.length > 1;
  // Only users without a fixed outlet — currently just platform admins — get
  // to switch outlets via the picker. Outlet admins are locked to their
  // assigned outlet; otherwise the dropdown can silently retarget mutations
  // (imports, category/item edits) to a sibling outlet.
  const canSwitchOutlet = tier === 'platform';
  const canImportFromBusiness = !isTemplate && !isReadOnly && !!businessId && !!outletId;
  const currentOutletName = outlets.find((o) => o.id === outletId)?.name;

  const clearImportSelection = () => {
    setImportPickCats(new Set());
    setImportPickSubs(new Set());
    setImportPickItems(new Set());
  };

  const openImportFromBusiness = async () => {
    if (!businessId) return;
    setImportBusinessOpen(true);
    setImportBusinessSummary(null);
    clearImportSelection();
    setImportTreeLoading(true);
    try {
      // Fetch business template + current outlet menu in parallel so we can
      // flag already-imported items. The match key scopes by menuId — two
      // different menus can legitimately have a "Specials" category, and
      // they should not collide.
      const [biz, outletMenu] = await Promise.all([
        api.get(`/businesses/${businessId}/menu`),
        api.get(`/outlets/${outletId}/menu`, { params: { includeHidden: 'true' } }),
      ]);
      const importedItemKeys = new Set<string>();
      for (const c of (outletMenu.data.data || [])) {
        for (const s of (c.subcategories || [])) {
          for (const it of (s.items || [])) {
            importedItemKeys.add(`${c.menuId ?? ''}|${c.name}|${s.name}|${it.name}`);
          }
        }
      }
      const tree = (biz.data.data || []).map((c: any) => ({
        ...c,
        subcategories: (c.subcategories || []).map((s: any) => ({
          ...s,
          items: (s.items || []).map((it: any) => ({
            ...it,
            alreadyImported: importedItemKeys.has(`${c.menuId ?? ''}|${c.name}|${s.name}|${it.name}`),
          })),
        })),
      }));
      setBusinessTemplate(tree);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not load business menu');
      setBusinessTemplate([]);
    } finally {
      setImportTreeLoading(false);
    }
  };

  const closeImportFromBusiness = () => {
    if (importBusinessBusy) return;
    setImportBusinessOpen(false);
    setBusinessTemplate(null);
    clearImportSelection();
  };

  // Cascade-aware predicates: an item is "in scope" if itself, its parent
  // sub, or its parent cat is picked. A sub is "in scope" if itself or its
  // parent cat is picked. A cat is in scope if itself is picked.
  const isCatPicked    = (catId: string) => importPickCats.has(catId);
  const isSubPicked    = (subId: string, parentCatId: string) =>
    importPickCats.has(parentCatId) || importPickSubs.has(subId);
  const isItemPicked   = (itemId: string, parentSubId: string, parentCatId: string) =>
    importPickCats.has(parentCatId) || importPickSubs.has(parentSubId) || importPickItems.has(itemId);

  const toggleImportCat = (cat: any) => {
    setImportPickCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat.id)) next.delete(cat.id);
      else next.add(cat.id);
      return next;
    });
    // Clearing redundant child picks keeps the selection set minimal and
    // avoids ambiguity at submit time.
    setImportPickSubs((prev) => {
      const next = new Set(prev);
      for (const s of (cat.subcategories || [])) next.delete(s.id);
      return next;
    });
    setImportPickItems((prev) => {
      const next = new Set(prev);
      for (const s of (cat.subcategories || [])) {
        for (const it of (s.items || [])) next.delete(it.id);
      }
      return next;
    });
  };

  const toggleImportSub = (sub: any, parentCatId: string) => {
    // If the parent cat is wholly picked, un-picking the cat first preserves
    // intent — user wanted partial selection. We don't try to be too clever:
    // just remove the parent from picked-cats and let the user re-build.
    setImportPickCats((prev) => {
      if (!prev.has(parentCatId)) return prev;
      const next = new Set(prev);
      next.delete(parentCatId);
      return next;
    });
    setImportPickSubs((prev) => {
      const next = new Set(prev);
      if (next.has(sub.id)) next.delete(sub.id);
      else next.add(sub.id);
      return next;
    });
    setImportPickItems((prev) => {
      const next = new Set(prev);
      for (const it of (sub.items || [])) next.delete(it.id);
      return next;
    });
  };

  const toggleImportItem = (itemId: string, parentSubId: string, parentCatId: string) => {
    // Same logic as sub toggle: remove parents from their picked sets if
    // they're "covering" this item, so the picks accurately reflect intent.
    setImportPickCats((prev) => {
      if (!prev.has(parentCatId)) return prev;
      const next = new Set(prev);
      next.delete(parentCatId);
      return next;
    });
    setImportPickSubs((prev) => {
      if (!prev.has(parentSubId)) return prev;
      const next = new Set(prev);
      next.delete(parentSubId);
      return next;
    });
    setImportPickItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Selection summary surfaced in the dialog header.
  const importSelectionCount = (() => {
    let n = 0;
    for (const c of (businessTemplate || [])) {
      const wholeCat = importPickCats.has(c.id);
      for (const s of (c.subcategories || [])) {
        const wholeSub = wholeCat || importPickSubs.has(s.id);
        const items = (s.items || []);
        if (wholeSub) {
          // Count items the outlet doesn't already have, so the badge matches
          // what'll actually be created.
          n += items.filter((it: any) => !it.alreadyImported).length;
        } else {
          for (const it of items) {
            if (importPickItems.has(it.id) && !it.alreadyImported) n++;
          }
        }
      }
    }
    return n;
  })();

  const runImportFromBusiness = async () => {
    if (!businessId || !outletId) return;
    if (importPickCats.size + importPickSubs.size + importPickItems.size === 0) {
      toast.error('Pick at least one category, subcategory or item');
      return;
    }
    setImportBusinessBusy(true);
    setImportBusinessSummary(null);
    try {
      const { data } = await api.post(
        `/outlets/${outletId}/menu/import-from-business/${businessId}`,
        {
          categoryIds: Array.from(importPickCats),
          subcategoryIds: Array.from(importPickSubs),
          itemIds: Array.from(importPickItems),
        },
      );
      const r = data.data;
      setImportBusinessSummary(r);
      const totalCreated = (r.categories ?? 0) + (r.subcategories ?? 0) + (r.items ?? 0);
      toast.success(
        totalCreated === 0
          ? 'Nothing new was imported — everything is already at this outlet'
          : `Imported ${r.categories} categor${r.categories === 1 ? 'y' : 'ies'}, ${r.subcategories} subcategor${r.subcategories === 1 ? 'y' : 'ies'}, ${r.items} item${r.items === 1 ? '' : 's'}`,
      );
      await fetchMenu();
      // Refresh the tree so just-imported rows reflect in the alreadyImported flag.
      openImportFromBusiness();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Import failed');
    } finally {
      setImportBusinessBusy(false);
    }
  };

  if (!isTemplate && !outletId && !loading) {
    return (
      <div className="card flex flex-col items-center py-20 text-center">
        <Store size={40} className="text-slate-200 mb-3" />
        <p className="text-slate-500 font-medium">No outlet selected</p>
        <p className="text-xs text-slate-400 mt-1">Create an outlet first to manage its menu.</p>
      </div>
    );
  }
  if (isTemplate && !businessId && !loading) {
    return (
      <div className="card flex flex-col items-center py-20 text-center">
        <Store size={40} className="text-slate-200 mb-3" />
        <p className="text-slate-500 font-medium">No business attached to your account</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header — brand identity (business or outlet) leads, with the
          subtitle calling out scope + counts. Falls back to a plain title
          when the upload hasn't been done yet. */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {(() => {
            const brandName = isTemplate
              ? (business?.name || 'Business Menu')
              : (currentOutlet?.name || 'Menu');
            const brandLogo = isTemplate ? business?.logoUrl : currentOutlet?.logoUrl;
            const initial = (brandName || '?').charAt(0).toUpperCase();
            return brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 text-white font-black text-lg flex items-center justify-center shrink-0">
                {initial}
              </div>
            );
          })()}
          <div className="min-w-0">
            <h1 className="page-title truncate">
              {isTemplate
                ? (business?.name || 'Business Menu (Template)')
                : (currentOutlet?.name || 'Menu Management')}
            </h1>
            <p className="page-subtitle">
              {isTemplate
                ? `Master template · ${categories.length} categories · ${totalItems} items — outlets import from here`
                : `Menu management · ${categories.length} categories · ${totalItems} items`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isTemplate && canSwitchOutlet && isMultiOutlet && (
            <select
              value={outletId}
              onChange={e => setOutletId(e.target.value)}
              className="input py-2 px-3 text-sm font-medium min-w-[180px]"
            >
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          {!isTemplate && !canSwitchOutlet && currentOutletName && (
            <span className="badge badge-slate" title="Imports and edits land on this outlet">
              <Store size={11} /> {currentOutletName}
            </span>
          )}
          {canImportFromBusiness && (
            <button
              className="btn-secondary"
              onClick={openImportFromBusiness}
              title="Pick items from the business master menu"
            >
              <Download size={15} /> Import from Business
            </button>
          )}
          {!isReadOnly && (
            <button className="btn-primary" onClick={() => setCatModal({ open: true })}>
              <Plus size={15} /> Add Category
            </button>
          )}
          {isReadOnly && (
            <span className="badge badge-slate"><Eye size={11} /> View only</span>
          )}
        </div>
      </div>

      {/* Multiple-menus flag toggle. Business tier writes Business flag
          (gates the menu-management chrome at the business level); outlet
          tier writes Outlet flag (gates customer + staff visibility for
          this specific outlet). When OFF, only the default menu's
          categories render at this surface. */}
      {!isReadOnly && (
        <div className="card p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-brand-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Multiple Menus</p>
              <p className="text-xs text-slate-500">
                {isTemplate
                  ? 'Run separate menus (e.g. Breakfast / Lunch) with their own categories and timings.'
                  : 'Show multiple menus to customers and staff at this outlet. When off, only the default menu is visible.'}
              </p>
            </div>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={multipleMenusEnabled}
              onChange={(e) => toggleMultipleMenus(e.target.checked)}
              className="sr-only peer"
            />
            <span className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-brand-500 relative transition-colors">
              <span className={clsx(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                multipleMenusEnabled && 'translate-x-4',
              )} />
            </span>
          </label>
        </div>
      )}

      {/* Menu tab strip — only when the flag is on. Each tab represents one
          menu; clicking switches the active context so category list,
          add-category, and edit operations all scope to it. The strip also
          hosts the "New menu" button, so it must render even when the menu
          list is empty (fresh business / outlet, or /menus fetch returned
          nothing) — otherwise the user has no way to create the first menu. */}
      {multipleMenusEnabled && (() => {
        // At outlet level, only show menus the outlet has actively imported
        // (the OutletMenu link row exists) plus the always-on default. Business
        // menus the outlet hasn't opted into stay hidden — the Import from
        // Business dialog is the only path that surfaces them.
        const visibleMenus = isTemplate
          ? menus
          : menus.filter((m) => m.isDefault || (m.outletMenu?.id != null));
        return (
        <div className="card p-2 flex items-center gap-1 overflow-x-auto">
          {visibleMenus.map((m, mIdx) => {
            const isActive = m.id === activeMenuId;
            return (
              <div key={m.id} className="flex items-center shrink-0">
                <button
                  onClick={() => setActiveMenuId(m.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5',
                    isActive
                      ? 'bg-brand-500 text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                    !m.isActive && 'opacity-60',
                  )}
                >
                  {m.name}
                  {m.isDefault && <span className="text-[9px] uppercase tracking-wide opacity-70">default</span>}
                  {!m.isActive && <EyeOff size={11} />}
                </button>
                {isActive && !isReadOnly && (
                  <div className="flex items-center ml-0.5">
                    <button
                      onClick={() => moveMenu(m.id, -1)}
                      disabled={mIdx === 0}
                      className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move menu earlier"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      onClick={() => moveMenu(m.id, 1)}
                      disabled={mIdx === visibleMenus.length - 1}
                      className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move menu later"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
                {isActive && isTemplate && !isReadOnly && (
                  <>
                    <button
                      onClick={() => setTimingsModal({ open: true, menu: m })}
                      className="btn-ghost p-1.5 ml-0.5"
                      title="Edit timings"
                    >
                      <Clock size={13} />
                    </button>
                    <button
                      onClick={() => setMenuModal({ open: true, editing: m })}
                      className="btn-ghost p-1.5"
                      title="Edit menu"
                    >
                      <Edit2 size={13} />
                    </button>
                    {!m.isDefault && (
                      <button
                        onClick={() => deleteMenu(m)}
                        className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                        title="Delete menu"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </>
                )}
                {isActive && !isTemplate && !isReadOnly && (
                  <>
                    {/* The default menu is the always-on fallback so we hide
                        its enable/disable button entirely — both the backend
                        and the TableTypeMenu UI refuse to disable it. */}
                    {!m.isDefault && (
                      <button
                        onClick={() => toggleOutletMenu(m, !(m.outletMenu?.isEnabled !== false))}
                        className={clsx(
                          'btn-ghost p-1.5 ml-0.5',
                          m.outletMenu?.isEnabled !== false ? 'text-emerald-600' : 'text-slate-400',
                        )}
                        title={m.outletMenu?.isEnabled !== false ? 'Disable this menu at this outlet' : 'Enable this menu at this outlet'}
                      >
                        {m.outletMenu?.isEnabled !== false ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                    )}
                    <button
                      onClick={() => setMenuModal({ open: true, editing: m })}
                      className="btn-ghost p-1.5"
                      title="Rename menu"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setTimingsModal({ open: true, menu: m })}
                      className="btn-ghost p-1.5"
                      title="Outlet-level timing override"
                    >
                      <Clock size={13} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {!isReadOnly && (
            <button
              onClick={() => setMenuModal({ open: true })}
              className="ml-1 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 shrink-0"
            >
              <Plus size={13} /> New menu
            </button>
          )}
        </div>
        );
      })()}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}</div>
      ) : categories.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <UtensilsCrossed size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No menu yet</p>
          {!isReadOnly && (
            <>
              <p className="text-xs text-slate-400 mt-1">
                {canImportFromBusiness
                  ? 'Start from scratch or pick items from the business master menu.'
                  : 'Start from scratch.'}
              </p>
              <div className="flex items-center gap-2 mt-4">
                <button className="btn-primary" onClick={() => setCatModal({ open: true })}><Plus size={14} /> Add first category</button>
                {canImportFromBusiness && (
                  <button className="btn-secondary" onClick={openImportFromBusiness}><Download size={14} /> Import from Business</button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            const visibleCats = categories.filter((cat) => !multipleMenusEnabled || !activeMenuId || cat.menuId === activeMenuId);
            return visibleCats.map((cat, catIdx) => {
            const catItems = cat.subcategories?.reduce((s: number, sc: any) => s + (sc.items?.length || 0), 0) || 0;
            const isOpen = expanded.has(cat.id);
            return (
              <div key={cat.id} className="card overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50">
                  <button className="flex items-center gap-3 flex-1 text-left" onClick={() => toggleExpand(cat.id)}>
                    <div className="icon-wrap w-8 h-8 bg-brand-50 text-brand-500 rounded-lg">
                      <UtensilsCrossed size={15} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{cat.name}</p>
                      <p className="text-xs text-slate-400">{catItems} item{catItems !== 1 ? 's' : ''}</p>
                    </div>
                    {isOpen ? <ChevronDown size={15} className="text-slate-400 ml-2" /> : <ChevronRight size={15} className="text-slate-400 ml-2" />}
                  </button>
                  {!isReadOnly && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => moveCategory(cat.id, -1)}
                        disabled={catIdx === 0}
                        className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move category up"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={() => moveCategory(cat.id, 1)}
                        disabled={catIdx === visibleCats.length - 1}
                        className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move category down"
                      >
                        <ChevronDown size={13} />
                      </button>
                      <button
                        onClick={() => setSubModal({ open: true, categoryId: cat.id })}
                        className="btn-ghost text-xs py-1.5 px-2 text-brand-600 hover:bg-brand-50"
                      >
                        <Plus size={13} /> Sub
                      </button>
                      <button onClick={() => setCatModal({ open: true, editing: cat })} className="btn-ghost p-1.5"><Edit2 size={13} /></button>
                      <button onClick={() => downloadMenuQr('category', cat.id, cat.name)} className="btn-ghost p-1.5 text-indigo-500 hover:bg-indigo-50" title="Download QR for this category"><QrCode size={13} /></button>
                      <button onClick={() => setDeleteTarget({ type: 'category', id: cat.id, name: cat.name })} className="btn-ghost p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>

                {/* Subcategories */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/40">
                    {cat.subcategories?.map((sub: any, subIdx: number) => (
                      <div key={sub.id} className="px-5 py-3 border-b border-slate-100 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {sub.imageUrl ? (
                              <img src={sub.imageUrl} alt="" className="w-7 h-7 rounded-md object-cover border border-slate-200 shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full shrink-0" />
                            )}
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{sub.name}</p>
                          </div>
                          {!isReadOnly && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => moveSubcategory(cat.id, sub.id, -1)}
                                disabled={subIdx === 0}
                                className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move subcategory up"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                onClick={() => moveSubcategory(cat.id, sub.id, 1)}
                                disabled={subIdx === (cat.subcategories?.length || 0) - 1}
                                className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move subcategory down"
                              >
                                <ChevronDown size={12} />
                              </button>
                              <button
                                onClick={() => setSubModal({ open: true, categoryId: cat.id, editing: sub })}
                                className="btn-ghost p-1.5 text-slate-500 hover:text-brand-600"
                                title="Edit subcategory"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => downloadMenuQr('subcategory', sub.id, sub.name)}
                                className="btn-ghost p-1.5 text-indigo-500 hover:bg-indigo-50"
                                title="Download QR for this subcategory"
                              >
                                <QrCode size={12} />
                              </button>
                              <button
                                onClick={() => setItemModal({ open: true, subcategoryId: sub.id })}
                                className="btn-ghost text-xs py-1 px-2 text-brand-600 hover:bg-brand-50"
                              >
                                <Plus size={12} /> Item
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {sub.items?.map((item: any, itemIdx: number) => (
                            <div key={item.id} className={clsx(
                              'flex items-center gap-3 p-3 rounded-xl border bg-white transition-all',
                              item.isAvailable ? 'border-slate-100' : 'border-red-100 bg-red-50/30',
                            )}>
                              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 text-lg">
                                {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover rounded-xl" /> : '🍽️'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <FoodGradeDot grade={item.foodGrade} />
                                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                                  {item.isPopular && <span className="badge badge-orange text-[10px]"><Star size={8} fill="currentColor" /> Popular</span>}
                                  {!item.isAvailable && <span className="badge badge-red text-[10px]">Unavailable</span>}
                                  {!item.isDisplayed && <span className="badge badge-slate text-[10px] flex items-center gap-0.5"><EyeOff size={9} /> Hidden</span>}
                                  {item.isBundle && <span className="badge text-[10px] bg-brand-50 text-brand-900 border border-brand-200">Bundle · {item.maxBundleSelections ? `pick ${item.maxBundleSelections}/${(item.bundleChildren || []).length}` : (item.bundleChildren || []).length}</span>}
                                  {item.hasLimitedStock && (
                                    <span className={clsx(
                                      'badge text-[10px] flex items-center gap-1',
                                      item.availableQuantity > 0 ? 'badge-emerald' : 'badge-red',
                                    )}>
                                      {item.availableQuantity > 0
                                        ? `${item.availableQuantity} left`
                                        : 'Out of stock'}
                                    </span>
                                  )}
                                </div>
                                {item.shortDescription && (
                                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.shortDescription}</p>
                                )}
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  <span className="text-sm font-bold text-brand-600">₹{Number(item.basePrice).toFixed(0)}</span>
                                  {item.preparationTime && <span className="text-xs text-slate-400">{item.preparationTime}m prep</span>}
                                  {item.variants?.length > 0 && !isReadOnly && (
                                    <button
                                      onClick={() => setVarModal({ open: true, itemId: item.id })}
                                      className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"
                                    >
                                      <Tag size={10} /> {item.variants.length} variant{item.variants.length > 1 ? 's' : ''} · + add
                                    </button>
                                  )}
                                  {item.variants?.length > 0 && isReadOnly && (
                                    <span className="text-xs text-indigo-600 flex items-center gap-0.5">
                                      <Tag size={10} /> {item.variants.length} variant{item.variants.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {item.variants?.length === 0 && !isReadOnly && (
                                    <button onClick={() => setVarModal({ open: true, itemId: item.id })} className="text-xs text-indigo-500 hover:underline">
                                      + add variant
                                    </button>
                                  )}
                                </div>
                                {/* Inline variants */}
                                {item.variants?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {item.variants.map((v: any) => (
                                      <span key={v.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                                        {v.name} · ₹{Number(v.price).toFixed(0)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Tag-price overrides */}
                                {item.customerTagPrices?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {item.customerTagPrices.map((p: any) => (
                                      <span
                                        key={p.id}
                                        className="text-[11px] font-semibold text-white px-2 py-0.5 rounded-full flex items-center gap-1"
                                        style={{ background: p.customerTag.color }}
                                        title={`${p.customerTag.name} price`}
                                      >
                                        <Tag size={9} /> {p.customerTag.name} · ₹{Number(p.price).toFixed(0)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {!isReadOnly && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => moveItem(cat.id, sub.id, item.id, -1)}
                                    disabled={itemIdx === 0}
                                    className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move item up"
                                  >
                                    <ChevronUp size={13} />
                                  </button>
                                  <button
                                    onClick={() => moveItem(cat.id, sub.id, item.id, 1)}
                                    disabled={itemIdx === (sub.items?.length || 0) - 1}
                                    className="btn-ghost p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move item down"
                                  >
                                    <ChevronDown size={13} />
                                  </button>
                                  {(customerTags.length > 0 || tableTypesList.length > 0 || (item.variants?.length ?? 0) > 0) && (
                                    <button
                                      onClick={() => openTagPrices(item)}
                                      className="btn-ghost p-1.5 text-violet-500 hover:bg-violet-50"
                                      title="Per-tag / section / variant pricing"
                                    >
                                      <IndianRupee size={13} />
                                    </button>
                                  )}
                                  {item.hasLimitedStock && (
                                    <button
                                      onClick={() => addStock(item)}
                                      title={`Add stock (currently ${item.availableQuantity} left)`}
                                      className="p-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                    >
                                      <PackagePlus size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => toggleAvailability(item.id)}
                                    title={item.isAvailable ? 'Available — tap to mark unavailable' : 'Unavailable — tap to mark available'}
                                    className={clsx('p-2 rounded-lg transition-colors', item.isAvailable ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-red-400 bg-red-50 hover:bg-red-100')}
                                  >
                                    {item.isAvailable ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                  </button>
                                  <button
                                    onClick={() => toggleVisibility(item.id)}
                                    title={item.isDisplayed
                                      ? 'Visible on customer menu — tap to hide (item still usable inside bundles)'
                                      : 'Hidden from customer menu — tap to show'}
                                    className={clsx('p-2 rounded-lg transition-colors', item.isDisplayed ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200')}
                                  >
                                    {item.isDisplayed ? <Eye size={14} /> : <EyeOff size={14} />}
                                  </button>
                                  <button onClick={() => setItemModal({ open: true, subcategoryId: sub.id, editing: item })} className="btn-ghost p-1.5"><Edit2 size={13} /></button>
                                  <button onClick={() => downloadMenuQr('item', item.id, item.name)} className="btn-ghost p-1.5 text-indigo-500 hover:bg-indigo-50" title="Download QR for this item"><QrCode size={13} /></button>
                                  <button onClick={() => setDeleteTarget({ type: 'item', id: item.id, name: item.name })} className="btn-ghost p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!cat.subcategories?.length && (
                      <p className="px-5 py-4 text-sm text-slate-400 italic">
                        No subcategories{!isReadOnly && (
                          <> — <button className="text-brand-500 hover:underline" onClick={() => setSubModal({ open: true, categoryId: cat.id })}>add one</button></>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          });
          })()}
        </div>
      )}

      {/* ── Category modal ──────────────────────────────────── */}
      <Modal
        open={catModal.open}
        onClose={() => setCatModal({ open: false })}
        title={catModal.editing ? 'Edit Category' : 'New Category'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCatModal({ open: false })}>Cancel</button>
            <button form="cat-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {catModal.editing ? 'Save Changes' : 'Create'}
            </button>
          </>
        }
      >
        <form id="cat-form" onSubmit={saveCategory} className="space-y-4">
          <Field label="Category Name">
            <input name="name" defaultValue={catModal.editing?.name} required className="input" placeholder="e.g. Breakfast" />
          </Field>
        </form>
      </Modal>

      {/* ── Subcategory modal ───────────────────────────────── */}
      <Modal
        open={subModal.open}
        onClose={() => setSubModal({ open: false })}
        title={subModal.editing ? 'Edit Subcategory' : 'New Subcategory'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSubModal({ open: false })}>Cancel</button>
            <button form="sub-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {subModal.editing ? 'Save' : 'Create'}
            </button>
          </>
        }
      >
        <form id="sub-form" onSubmit={saveSubcategory} className="space-y-4">
          <Field label="Subcategory Name">
            <input name="name" defaultValue={subModal.editing?.name} required className="input" placeholder="e.g. South Indian" />
          </Field>
          <Field label="Thumbnail">
            <input
              ref={subImageRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPickSubImage}
            />
            {subImage ? (
              <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-200">
                <img src={subImage} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => subImageRef.current?.click()}
                    className="bg-white/90 text-slate-900 text-[10px] font-bold px-2 py-1 rounded-md"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubImage(null)}
                    className="bg-red-500 text-white p-1 rounded-md"
                    title="Remove"
                  >
                    <XIcon size={11} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => subImageRef.current?.click()}
                className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/30 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-brand-600 transition-colors"
              >
                <ImagePlus size={20} />
                <span className="text-[10px] font-semibold">Thumbnail</span>
              </button>
            )}
            <p className="text-[11px] text-slate-400 mt-1.5">JPG / PNG / WebP. ≤300 KB. Shown on the customer Place Order screen.</p>
          </Field>
        </form>
      </Modal>

      {/* ── Item modal ──────────────────────────────────────── */}
      <Modal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false })}
        title={itemModal.editing ? 'Edit Item' : 'New Menu Item'}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setItemModal({ open: false })}>Cancel</button>
            <button form="item-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {itemModal.editing ? 'Save Changes' : 'Create Item'}
            </button>
          </>
        }
      >
        <form id="item-form" onSubmit={saveItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Thumbnail">
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPickThumbnail}
              />
              {thumbnail ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200">
                  <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setThumbnail(null)}
                    className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-md"
                    title="Remove"
                  >
                    <XIcon size={11} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/30 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-brand-600 transition-colors"
                >
                  <ImagePlus size={18} />
                  <span className="text-[10px] font-semibold">Thumbnail</span>
                </button>
              )}
              <p className="text-[11px] text-slate-400 mt-1.5">JPG / PNG / WebP. ≤300&nbsp;KB. 320×320.</p>
            </Field>
            <Field label="Primary photo">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPickImage}
              />
              {itemImage ? (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200">
                  <img src={itemImage} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white/90 text-slate-900 text-[10px] font-bold px-2 py-1 rounded-md"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemImage(null)}
                      className="bg-red-500 text-white p-1 rounded-md"
                      title="Remove"
                    >
                      <XIcon size={11} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/30 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-brand-600 transition-colors"
                >
                  <ImagePlus size={20} />
                  <span className="text-[10px] font-semibold">Primary photo</span>
                </button>
              )}
              <p className="text-[11px] text-slate-400 mt-1.5">JPG / PNG / WebP. ≤1&nbsp;MB. 800×800.</p>
            </Field>
          </div>

          <Field label="Gallery (optional)">
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPickGallery}
            />
            <div className="flex items-center gap-2 flex-wrap">
              {gallery.map((g, idx) => (
                <div key={g.id || idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                  <img src={g.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setGallery(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded"
                    title="Remove"
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/30 flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-brand-600 transition-colors"
              >
                <ImagePlus size={14} />
                <span className="text-[9px] font-semibold">Add</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">JPG / PNG / WebP. ≤1&nbsp;MB each.</p>
          </Field>
          <Field label="Item Name">
            <input name="name" defaultValue={itemModal.editing?.name} required className="input" placeholder="e.g. Masala Dosa" />
          </Field>
          <Field label="Food Grade">
            <div className="flex gap-2">
              {[
                { v: 'VEG',     l: 'Veg',     d: '#16a34a' },
                { v: 'NON_VEG', l: 'Non-Veg', d: '#dc2626' },
                { v: 'VEGAN',   l: 'Vegan',   d: '#0d9488' },
              ].map(g => (
                <label key={g.v} className="flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer hover:bg-slate-50 has-[:checked]:bg-brand-50 has-[:checked]:border-brand-300 flex-1">
                  <input
                    type="radio"
                    name="foodGrade"
                    value={g.v}
                    defaultChecked={(itemModal.editing?.foodGrade || 'VEG') === g.v}
                    className="accent-brand-500"
                  />
                  <span className="w-3 h-3 rounded-sm border-2" style={{ borderColor: g.d, background: `${g.d}33` }} />
                  <span className="text-sm font-medium text-slate-700">{g.l}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Short Description (≤ 50 chars)">
            <input
              name="shortDescription"
              maxLength={50}
              defaultValue={itemModal.editing?.shortDescription || ''}
              className="input"
              placeholder="One-line teaser — shown in listings"
            />
            <p className="text-[11px] text-slate-400 mt-1">Shown on the menu card.</p>
          </Field>
          <Field label="Long Description (≤ 250 chars)">
            <textarea
              name="longDescription"
              maxLength={250}
              defaultValue={itemModal.editing?.longDescription || ''}
              rows={3}
              className="input resize-none"
              placeholder="Detail view — ingredients, serving info, etc."
            />
            <p className="text-[11px] text-slate-400 mt-1">Shown in the item detail view.</p>
          </Field>
          <Field label="Base Price (₹)">
            <input name="basePrice" type="number" min="0" step="0.50" defaultValue={itemModal.editing?.basePrice} required className="input" placeholder="0.00" />
          </Field>
          <Field label="Default GST %">
            <input
              key={`gst-${itemModal.editing?.id || 'new'}-${currentOutlet?.id || ''}`}
              name="gstRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={
                itemModal.editing?.gstRate != null
                  ? Number(itemModal.editing.gstRate)
                  : currentOutlet?.gstApplicable
                    ? Number(currentOutlet.gstPercent || 0)
                    : ''
              }
              className="input"
              placeholder="0"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Applied to this item by default. Customer tag / dine-in section can override below. SGST and CGST are auto-split 50/50 on the bill.
            </p>
          </Field>

          <Field label="Parcel">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                name="parcelAvailable"
                defaultChecked={itemModal.editing ? !!itemModal.editing.parcelAvailable : true}
                className="w-4 h-4 accent-brand-500 rounded"
              />
              <span className="text-sm font-medium text-slate-700">Available for parcel / takeaway</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                name="useCustomParcelCharge"
                defaultChecked={!!itemModal.editing?.useCustomParcelCharge}
                className="w-4 h-4 accent-brand-500 rounded"
              />
              <span className="text-xs text-slate-600">Use a custom parcel charge for this item (otherwise outlet default applies)</span>
            </label>
            <input
              name="parcelCharge"
              type="number"
              min="0"
              step="0.50"
              defaultValue={itemModal.editing?.parcelCharge}
              className="input"
              placeholder="Custom parcel charge (₹)"
            />
          </Field>

          <Field label="Preparation Time (minutes)">
            <input name="preparationTime" type="number" min="1" defaultValue={itemModal.editing?.preparationTime} className="input" placeholder="e.g. 10" />
          </Field>

          <Field label="Quantity unit">
            <select
              value={itemQuantityUnit}
              onChange={(e) => setItemQuantityUnit(e.target.value as any)}
              className="input"
            >
              <option value="NUMBER">Number (count) — e.g. 1 dish, 2 dishes</option>
              <option value="GRAMS">Weight — grams (g)</option>
              <option value="MILLILITERS">Volume — millilitres (ml)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {itemQuantityUnit === 'NUMBER'
                ? 'Default — customer picks how many.'
                : 'Customer picks a portion size from the predefined list below.'}
            </p>
          </Field>

          <Field label={itemQuantityUnit === 'NUMBER' ? 'Variants' : 'Available sizes'}>
            <p className="text-[11px] text-slate-400 mb-2">
              {itemQuantityUnit === 'NUMBER'
                ? 'Add sizes like Half / Full / Family. Each variant has its own price; short description is optional.'
                : itemQuantityUnit === 'GRAMS'
                  ? 'Add portion sizes in grams (e.g. 100, 250, 500). The customer picks one.'
                  : 'Add portion sizes in millilitres (e.g. 200, 400, 750). The customer picks one.'}
            </p>
            <div className="space-y-2">
              {variantsDraft.map((v, idx) => itemQuantityUnit !== 'NUMBER' ? (
                <div key={v.id || `new-${idx}`} className="bg-slate-50 rounded-xl p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Size"
                        value={v.unitQuantity || ''}
                        onChange={(e) => setVariantsDraft((prev) => prev.map((x, i) => i === idx ? { ...x, unitQuantity: e.target.value } : x))}
                        className="input pr-10 text-sm py-1.5"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                        {itemQuantityUnit === 'GRAMS' ? 'g' : 'ml'}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      placeholder="Price ₹"
                      value={v.price}
                      onChange={(e) => setVariantsDraft((prev) => prev.map((x, i) => i === idx ? { ...x, price: e.target.value } : x))}
                      className="input w-28 text-sm py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => setVariantsDraft((prev) => prev.filter((_, i) => i !== idx))}
                      className="btn-ghost p-1.5 text-slate-400 hover:text-red-500"
                      title="Remove size"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div key={v.id || `new-${idx}`} className="bg-slate-50 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="Variant name (e.g. Large)"
                      value={v.name}
                      onChange={e => setVariantsDraft(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                      className="input flex-1 text-sm py-1.5"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      placeholder="Price ₹"
                      value={v.price}
                      onChange={e => setVariantsDraft(prev => prev.map((x, i) => i === idx ? { ...x, price: e.target.value } : x))}
                      className="input w-28 text-sm py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => setVariantsDraft(prev => prev.filter((_, i) => i !== idx))}
                      className="btn-ghost p-1.5 text-slate-400 hover:text-red-500"
                      title="Remove variant"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <input
                    placeholder="Short description (optional, ≤ 80 chars)"
                    maxLength={80}
                    value={v.shortDescription}
                    onChange={e => setVariantsDraft(prev => prev.map((x, i) => i === idx ? { ...x, shortDescription: e.target.value } : x))}
                    className="input text-xs py-1.5"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setVariantsDraft(prev => [...prev, { name: '', shortDescription: '', price: '', unitQuantity: '' }])}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
              >
                <Plus size={12} /> {itemQuantityUnit === 'NUMBER' ? 'Add variant' : 'Add size'}
              </button>
              {variantsDraft.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  {itemQuantityUnit === 'NUMBER'
                    ? 'No variants — item is sold at the base price.'
                    : 'No sizes yet — add at least one portion size for the customer to pick from.'}
                </p>
              )}
            </div>
          </Field>

          {/* Toppings are outlet-scoped (live on Outlet.toppings) so they
              can't be attached to a Business Menu (Template) item — the
              template gets copied into an outlet, and toppings are wired up
              there instead. */}
          {!isTemplate && <Field label="Toppings">
            {outletToppings.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No toppings defined yet — create some in the Toppings page.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {outletToppings.map((t: any) => {
                  const d = itemToppingDraft[t.id] || { selected: false, priceAdd: '', isRequired: false };
                  return (
                    <div key={t.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100">
                      <input
                        type="checkbox"
                        checked={d.selected}
                        onChange={e =>
                          setItemToppingDraft(p => ({ ...p, [t.id]: { ...d, selected: e.target.checked } }))
                        }
                        className="w-4 h-4 accent-brand-500 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{t.name}</p>
                        <p className="text-[10px] text-slate-400">
                          Base +₹{Number(t.basePriceAdd).toFixed(0)}{t.options.length ? ` · ${t.options.length} radio options` : ''}
                        </p>
                      </div>
                      {d.selected && (
                        <>
                          <input
                            type="number"
                            min="0"
                            step="0.50"
                            placeholder={`+₹${Number(t.basePriceAdd).toFixed(0)}`}
                            value={d.priceAdd}
                            onChange={e =>
                              setItemToppingDraft(p => ({ ...p, [t.id]: { ...d, priceAdd: e.target.value } }))
                            }
                            className="input w-20 text-xs"
                            title="Override the base price for this item (leave blank to use base)"
                          />
                          <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={d.isRequired}
                              onChange={e =>
                                setItemToppingDraft(p => ({ ...p, [t.id]: { ...d, isRequired: e.target.checked } }))
                              }
                              className="w-3 h-3 accent-brand-500 rounded"
                            />
                            Required
                          </label>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Field>}

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="isPopular" defaultChecked={itemModal.editing?.isPopular} className="w-4 h-4 accent-brand-500 rounded" />
              <span className="text-sm font-medium text-slate-700">Manually mark as Popular</span>
              <span className="text-[10px] text-slate-400">(auto: top-5 ordered are also marked)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="isSpecial" defaultChecked={itemModal.editing?.isSpecial} className="w-4 h-4 accent-amber-500 rounded" />
              <span className="text-sm font-medium text-slate-700">Mark as <span className="font-bold text-amber-600">Special</span></span>
              <span className="text-[10px] text-slate-400">(shown under "Special" tab)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isDisplayed"
                defaultChecked={itemModal.editing ? itemModal.editing.isDisplayed !== false : true}
                className="w-4 h-4 accent-indigo-500 rounded"
              />
              <span className="text-sm font-medium text-slate-700">Visible on customer menu</span>
              <span className="text-[10px] text-slate-400">(uncheck for bundle-only items, e.g. mini dosa)</span>
            </label>
          </div>

          {/* ── Limited stock ─────────────────────────────────── */}
          <LimitedStockField editing={itemModal.editing} key={itemModal.editing?.id ?? 'new-stock'} />

          {/* ── Bundle composition ────────────────────────────── */}
          <BundleSection
            isBundle={isBundleDraft}
            setIsBundle={setIsBundleDraft}
            rows={bundleChildrenDraft}
            setRows={setBundleChildrenDraft}
            allItems={categories}
            editingId={itemModal.editing?.id}
            maxPicks={maxBundleSelectionsDraft}
            setMaxPicks={setMaxBundleSelectionsDraft}
          />
        </form>
      </Modal>

      {/* ── Variant modal ───────────────────────────────────── */}
      <Modal
        open={varModal.open}
        onClose={() => setVarModal({ open: false })}
        title="Add Variant"
        subtitle="e.g. Small / Medium / Large"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setVarModal({ open: false })}>Cancel</button>
            <button form="var-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Add Variant
            </button>
          </>
        }
      >
        <form id="var-form" onSubmit={saveVariant} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Variant Name">
              <input name="name" required className="input" placeholder="e.g. Large" />
            </Field>
            <Field label="Price (₹)">
              <input name="price" type="number" min="0" step="0.50" required className="input" placeholder="0.00" />
            </Field>
          </div>
          <Field label="Short Description (≤ 80 chars)">
            <input name="shortDescription" maxLength={80} className="input" placeholder="e.g. Serves 2 — comes with chutney" />
          </Field>
        </form>
      </Modal>

      {/* ── Tag prices modal ────────────────────────────────── */}
      <Modal
        open={tagPriceModal.open}
        onClose={() => !saving && setTagPriceModal({ open: false })}
        title={`Price & GST overrides — ${tagPriceModal.item?.name || ''}`}
        subtitle={`Base ₹${Number(tagPriceModal.item?.basePrice || 0).toFixed(2)}${tagPriceModal.item?.gstRate != null ? ` · default GST ${Number(tagPriceModal.item.gstRate)}%` : ''}. Leave a cell blank to inherit the item default.`}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTagPriceModal({ open: false })} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={saveAllTagPrices} disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Save
            </button>
          </>
        }
      >
        {customerTags.length === 0 && tableTypesList.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No customer tags or dine-in sections defined for this outlet yet.</p>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {(() => {
              const rows: { variantId: string; label: string; basePrice: number }[] = [
                { variantId: '', label: 'Base item', basePrice: Number(tagPriceModal.item?.basePrice || 0) },
                ...((tagPriceModal.item?.variants || []) as any[]).map(v => ({
                  variantId: v.id,
                  label: v.name,
                  basePrice: Number(v.price),
                })),
              ];
              return rows.map(row => (
                <div key={row.variantId || 'base'} className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    {row.label} <span className="text-slate-400 font-medium">· base ₹{row.basePrice.toFixed(2)}</span>
                  </p>
                  {customerTags.map(t => {
                    const key = `tag:${t.id}:${row.variantId}`;
                    const cell = tagPriceDraft[key] || { price: '', gstRate: '' };
                    const setCell = (patch: Partial<PriceCellDraft>) =>
                      setTagPriceDraft(prev => ({ ...prev, [key]: { ...(prev[key] || { price: '', gstRate: '', inheritedGst: '' }), ...patch } }));
                    return (
                      <div key={`tag-${t.id}`} className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-full min-w-[110px] justify-center"
                          style={{ background: t.color }}
                        >
                          <Tag size={10} /> {t.name}
                        </span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                          <input
                            type="number" min="0" step="0.50"
                            value={cell.price}
                            onChange={e => setCell({ price: e.target.value })}
                            placeholder={`Base ₹${row.basePrice.toFixed(2)}`}
                            className="input pl-7"
                          />
                        </div>
                        <div className="relative w-24">
                          <input
                            type="number" min="0" max="100" step="0.01"
                            value={cell.gstRate}
                            onChange={e => setCell({ gstRate: e.target.value })}
                            placeholder="GST %"
                            className="input pr-6 text-sm"
                            title="Optional GST % for this tag — overrides item default"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                        </div>
                        {(cell.price || cell.gstRate) && (
                          <button type="button" onClick={() => setCell({ price: '', gstRate: cell.inheritedGst })} className="btn-ghost p-1.5 text-slate-400 hover:text-red-500" title="Clear override — inherit item default"><XIcon size={14} /></button>
                        )}
                      </div>
                    );
                  })}
                  {tableTypesList
                    .filter((tt) => {
                      // Hide sections that have this item's menu disabled —
                      // their customers can't see the item, so pricing it
                      // would just be dead state.
                      const itemMenuId = itemMenuById.get(tagPriceModal.item?.id);
                      const disabled: string[] = tt.disabledMenuIds || [];
                      return !itemMenuId || !disabled.includes(itemMenuId);
                    })
                    .map(tt => {
                    const key = `tt:${tt.id}:${row.variantId}`;
                    const cell = tagPriceDraft[key] || { price: '', gstRate: '' };
                    const setCell = (patch: Partial<PriceCellDraft>) =>
                      setTagPriceDraft(prev => ({ ...prev, [key]: { ...(prev[key] || { price: '', gstRate: '', inheritedGst: '' }), ...patch } }));
                    return (
                      <div key={`tt-${tt.id}`} className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-full min-w-[110px] justify-center"
                          style={{ background: tt.color }}
                          title="Dine-in section"
                        >
                          🪑 {tt.name}
                        </span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                          <input
                            type="number" min="0" step="0.50"
                            value={cell.price}
                            onChange={e => setCell({ price: e.target.value })}
                            placeholder={`Base ₹${row.basePrice.toFixed(2)}`}
                            className="input pl-7"
                          />
                        </div>
                        <div className="relative w-24">
                          <input
                            type="number" min="0" max="100" step="0.01"
                            value={cell.gstRate}
                            onChange={e => setCell({ gstRate: e.target.value })}
                            placeholder="GST %"
                            className="input pr-6 text-sm"
                            title="Optional GST % for this dine-in section — overrides item default"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                        </div>
                        {(cell.price || cell.gstRate) && (
                          <button type="button" onClick={() => setCell({ price: '', gstRate: cell.inheritedGst })} className="btn-ghost p-1.5 text-slate-400 hover:text-red-500" title="Clear override — inherit item default"><XIcon size={14} /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
      </Modal>

      {/* ── Delete confirm ──────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteTarget?.type}`}
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={saving}
      />

      {/* ── Import-from-Business modal ──────────────────────── */}
      <Modal
        open={importBusinessOpen}
        onClose={closeImportFromBusiness}
        title={`Import from Business menu → ${currentOutletName || 'this outlet'}`}
        subtitle="Pick a category, subcategory, or individual items. Picking a category brings its whole tree across (including empty subs). Imported rows are independent copies at this outlet — the business template is untouched."
        size="lg"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-500">
              {importPickCats.size + importPickSubs.size + importPickItems.size === 0
                ? 'Nothing picked yet. Use the checkboxes to select what to bring across.'
                : `${importSelectionCount} new item${importSelectionCount === 1 ? '' : 's'} will be created. ${importPickCats.size} categor${importPickCats.size === 1 ? 'y' : 'ies'}, ${importPickSubs.size} subcategor${importPickSubs.size === 1 ? 'y' : 'ies'}, ${importPickItems.size} item-only pick${importPickItems.size === 1 ? '' : 's'}.`}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                onClick={clearImportSelection}
                disabled={importPickCats.size + importPickSubs.size + importPickItems.size === 0}
              >
                Clear selection
              </button>
            </div>
          </div>

          {importBusinessSummary && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700">
              Imported {importBusinessSummary.categories} categor{importBusinessSummary.categories === 1 ? 'y' : 'ies'}, {importBusinessSummary.subcategories} subcategor{importBusinessSummary.subcategories === 1 ? 'y' : 'ies'}, {importBusinessSummary.items} item{importBusinessSummary.items === 1 ? '' : 's'} into your outlet.
            </div>
          )}

          {importTreeLoading ? (
            <div className="py-6 text-center text-xs text-slate-500">Loading business menu…</div>
          ) : !businessTemplate || businessTemplate.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              The business hasn't published any categories yet.
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {businessTemplate.map((cat: any) => {
                const allItems = (cat.subcategories || []).flatMap((s: any) => s.items || []);
                const itemCount = allItems.length;
                const catChecked = isCatPicked(cat.id);
                const catHasChildPick = !catChecked && (
                  (cat.subcategories || []).some((s: any) =>
                    importPickSubs.has(s.id) || (s.items || []).some((it: any) => importPickItems.has(it.id)),
                  )
                );
                return (
                  <div key={cat.id} className="border border-slate-100 rounded-xl overflow-hidden">
                    <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={catChecked}
                        ref={(el) => { if (el) el.indeterminate = catHasChildPick; }}
                        onChange={() => toggleImportCat(cat)}
                        className="accent-brand-500"
                      />
                      <p className="text-sm font-bold text-slate-800 flex-1">{cat.name}</p>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {itemCount} item{itemCount === 1 ? '' : 's'}
                      </span>
                    </label>
                    <div className="divide-y divide-slate-50">
                      {(cat.subcategories || []).map((sub: any) => {
                        const subItems: any[] = sub.items || [];
                        const subChecked = isSubPicked(sub.id, cat.id);
                        const subHasChildPick = !subChecked && subItems.some((it: any) => importPickItems.has(it.id));
                        return (
                          <div key={sub.id}>
                            <label className="flex items-center gap-2 px-4 py-1.5 bg-white cursor-pointer">
                              <input
                                type="checkbox"
                                checked={subChecked}
                                ref={(el) => { if (el) el.indeterminate = subHasChildPick; }}
                                onChange={() => toggleImportSub(sub, cat.id)}
                                className="accent-brand-500"
                              />
                              <p className="text-xs font-semibold text-slate-600 flex-1">{sub.name}</p>
                              <span className="text-[10px] text-slate-400">
                                {subItems.length} item{subItems.length === 1 ? '' : 's'}
                              </span>
                            </label>
                            {subItems.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic px-10 py-1.5">
                                No items in this subcategory{subChecked ? ' — the empty sub will still be copied' : ''}
                              </p>
                            ) : (
                              <div className="divide-y divide-slate-50">
                                {subItems.map((it: any) => {
                                  const itemChecked = isItemPicked(it.id, sub.id, cat.id);
                                  // Already-imported items are shown but
                                  // greyed out so the user gets the full
                                  // picture; the import call simply skips
                                  // dupes on the server side.
                                  return (
                                    <label
                                      key={it.id}
                                      className={`flex items-center gap-2 px-10 py-2 text-xs cursor-pointer ${
                                        it.alreadyImported ? 'opacity-60' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={itemChecked}
                                        onChange={() => toggleImportItem(it.id, sub.id, cat.id)}
                                        className="accent-brand-500"
                                      />
                                      <span className="flex-1 font-medium text-slate-700">{it.name}</span>
                                      <span className="font-mono text-slate-500">₹{Number(it.basePrice).toFixed(0)}</span>
                                      {it.alreadyImported && (
                                        <span className="badge badge-slate text-[10px]">Already imported</span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {(cat.subcategories || []).length === 0 && (
                        <p className="text-[11px] text-slate-400 italic px-4 py-2">
                          No subcategories yet{catChecked ? ' — the empty category will still be copied' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              className="btn-secondary"
              onClick={closeImportFromBusiness}
              disabled={importBusinessBusy}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={runImportFromBusiness}
              disabled={importBusinessBusy || (importPickCats.size + importPickSubs.size + importPickItems.size === 0)}
            >
              {importBusinessBusy && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <Download size={14} /> Import
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Menu create/edit modal ─────────────────────────── */}
      <Modal
        open={menuModal.open}
        onClose={() => setMenuModal({ open: false })}
        title={menuModal.editing ? `Edit menu: ${menuModal.editing.name}` : 'New menu'}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary" onClick={() => setMenuModal({ open: false })}>Cancel</button>
            <button type="submit" form="menu-form" className="btn-primary" disabled={menuBusy}>
              {menuBusy ? 'Saving…' : (menuModal.editing ? 'Save' : 'Create')}
            </button>
          </div>
        }
      >
        <form id="menu-form" onSubmit={saveMenu} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Name</label>
            <input
              name="name"
              defaultValue={menuModal.editing?.name || ''}
              autoFocus
              className="input w-full"
              placeholder="e.g. Breakfast"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Description (optional)</label>
            <input
              name="description"
              defaultValue={(menuModal.editing as any)?.description || ''}
              className="input w-full"
              placeholder="Morning specials, 7–11 am"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={menuModal.editing?.isActive !== false}
            />
            Active (off = hide from customers)
          </label>
        </form>
      </Modal>

      {/* ── Per-day timings editor (multi-slot) ──────────────── */}
      <TimingsEditorModal
        open={timingsModal.open}
        menu={timingsModal.menu}
        mode={isTemplate ? 'business' : 'outlet'}
        outletId={outletId}
        onClose={() => setTimingsModal({ open: false })}
        onSaved={() => { setTimingsModal({ open: false }); fetchMenu(); }}
      />
    </div>
  );
}

// ── Timings editor (extracted) ─────────────────────────────
// Lets the admin define 1+ availability slots per day-of-week. Times are
// stored as minutes-since-midnight (matches the API contract). The form
// renders one row per slot with day picker, start time, end time, and a
// remove button; a footer button adds a new row.
function TimingsEditorModal({
  open, menu, mode = 'business', outletId, onClose, onSaved,
}: {
  open: boolean;
  menu?: {
    id: string;
    name: string;
    timingSlots: { dayOfWeek: number; startMinute: number; endMinute: number }[];
    outletMenu?: { overrideTimings: boolean; timingSlots: { dayOfWeek: number; startMinute: number; endMinute: number }[] };
  };
  mode?: 'business' | 'outlet';
  outletId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  type Slot = { dayOfWeek: number; startMinute: number; endMinute: number };
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!menu) return;
    // Outlet mode pre-loads from the override slots if any; otherwise it
    // seeds from the business slots so the admin can start from a sane copy.
    const source = mode === 'outlet' && menu.outletMenu?.overrideTimings
      ? menu.outletMenu.timingSlots
      : menu.timingSlots;
    setSlots(source.map((s) => ({
      dayOfWeek: s.dayOfWeek, startMinute: s.startMinute, endMinute: s.endMinute,
    })));
  }, [menu, mode]);

  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toMinutes = (t: string) => {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const toTimeString = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const save = async () => {
    if (!menu) return;
    for (const s of slots) {
      if (s.endMinute <= s.startMinute) {
        toast.error('Each slot must end after it starts');
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'outlet') {
        if (!outletId) { toast.error('Missing outlet context'); return; }
        // PUT creates the OutletMenu link if needed; flipping overrideTimings
        // tells the API to use these slots in customer queries.
        await api.put(`/outlets/${outletId}/menus/${menu.id}/timings`, { slots });
        await api.patch(`/outlets/${outletId}/menus/${menu.id}`, { overrideTimings: slots.length > 0 });
      } else {
        await api.put(`/menus/${menu.id}/timings`, { slots });
      }
      toast.success('Timings saved');
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save timings');
    } finally {
      setBusy(false);
    }
  };

  if (!menu) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Timings — ${menu.name}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            className="btn-ghost text-xs"
            onClick={() => setSlots((s) => [...s, { dayOfWeek: 1, startMinute: 9 * 60, endMinute: 17 * 60 }])}
          >
            <Plus size={13} /> Add slot
          </button>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save timings'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {mode === 'outlet' && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-[11px] text-amber-800 mb-2">
            Outlet override — these slots take precedence over the business-level timings while saved.
            Clear all slots and save to fall back to the business defaults.
          </div>
        )}
        {slots.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">
            No timing slots — this menu is always available. Click "Add slot" to restrict it.
          </p>
        ) : (
          slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={slot.dayOfWeek}
                onChange={(e) =>
                  setSlots((all) => all.map((s, idx) => idx === i ? { ...s, dayOfWeek: Number(e.target.value) } : s))
                }
                className="input py-1.5 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{dayNames[d]}</option>)}
              </select>
              <input
                type="time"
                value={toTimeString(slot.startMinute)}
                onChange={(e) =>
                  setSlots((all) => all.map((s, idx) => idx === i ? { ...s, startMinute: toMinutes(e.target.value) } : s))
                }
                className="input py-1.5 text-sm"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="time"
                value={toTimeString(slot.endMinute)}
                onChange={(e) =>
                  setSlots((all) => all.map((s, idx) => idx === i ? { ...s, endMinute: toMinutes(e.target.value) } : s))
                }
                className="input py-1.5 text-sm"
              />
              <button
                onClick={() => setSlots((all) => all.filter((_, idx) => idx !== i))}
                className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                title="Remove slot"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

/* ── Limited-stock toggle + initial quantity ────────────────────
 * Local state so toggling the checkbox reveals/hides the quantity input.
 * When editing an existing item, shows the current remaining stock (read-only)
 * and adjustments happen via the dedicated "Add stock" action on the item row.
 */
function LimitedStockField({ editing }: { editing?: any }) {
  const isEdit = !!editing;
  const initialOn = !!editing?.hasLimitedStock;
  const [on, setOn] = useState(initialOn);
  return (
    <div className="border-t border-slate-100 pt-3 mt-1 space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="hasLimitedStock"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="w-4 h-4 accent-emerald-500 rounded"
        />
        <span className="text-sm font-medium text-slate-700">Limited stock</span>
        <span className="text-[10px] text-slate-400">(auto-hides when count reaches 0)</span>
      </label>
      {on && (
        <div className="grid grid-cols-2 gap-3 pl-6">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              {isEdit ? 'Set to (overrides current)' : 'Initial quantity'}
            </label>
            <input
              type="number"
              name="availableQuantity"
              min="0"
              step="1"
              defaultValue={editing?.availableQuantity ?? ''}
              placeholder="0"
              className="input"
            />
          </div>
          {isEdit && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Currently available
              </label>
              <div className={clsx(
                'h-[42px] px-3 rounded-lg flex items-center font-bold text-sm',
                editing.availableQuantity > 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-red-50 text-red-700 border border-red-100',
              )}>
                {editing.availableQuantity ?? 0} left
              </div>
            </div>
          )}
          {isEdit && (
            <p className="col-span-2 text-[11px] text-slate-500 -mt-1">
              To <strong>add more stock</strong>, close this form and use the green "+ Stock" button on the item row.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Bundle composition section ──────────────────────────────────
   Inline editor for the parent item's child items. Empty children list
   when isBundle is off — toggling the flag shows the editor without
   destroying anything until the admin actually clears rows. */
function BundleSection({
  isBundle, setIsBundle, rows, setRows, allItems, editingId, maxPicks, setMaxPicks,
}: {
  isBundle: boolean;
  setIsBundle: (v: boolean) => void;
  rows: { childItemId: string; variantId: string | null; quantity: number }[];
  setRows: React.Dispatch<React.SetStateAction<{ childItemId: string; variantId: string | null; quantity: number }[]>>;
  allItems: any[];
  editingId?: string;
  maxPicks: number;
  setMaxPicks: (v: number) => void;
}) {
  // Flatten the menu tree to a picker-friendly list. Exclude the item
  // we're currently editing so a bundle can't include itself.
  const flat = useMemo(() => {
    const out: { id: string; name: string; subName: string; variants: { id: string; name: string }[]; isBundle?: boolean }[] = [];
    for (const cat of allItems || []) {
      for (const sub of cat.subcategories || []) {
        for (const it of sub.items || []) {
          if (editingId && it.id === editingId) continue;
          out.push({
            id: it.id,
            name: it.name,
            subName: `${cat.name} › ${sub.name}`,
            variants: (it.variants || []).map((v: any) => ({ id: v.id, name: v.name })),
            isBundle: !!it.isBundle,
          });
        }
      }
    }
    return out;
  }, [allItems, editingId]);

  const itemById = useMemo(() => new Map(flat.map((i) => [i.id, i])), [flat]);

  const addRow = () => setRows((p) => [...p, { childItemId: '', variantId: null, quantity: 1 }]);
  const removeRow = (idx: number) => setRows((p) => p.filter((_, i) => i !== idx));
  const patchRow = (idx: number, patch: Partial<{ childItemId: string; variantId: string | null; quantity: number }>) =>
    setRows((p) => p.map((c, i) => i === idx ? { ...c, ...patch } : c));

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/40">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isBundle}
          onChange={(e) => setIsBundle(e.target.checked)}
          className="w-4 h-4 accent-brand-700 rounded"
        />
        <span className="text-sm font-bold text-slate-700">This item is a bundle</span>
        <span className="text-[10px] text-slate-400">
          (combo / thali — at order time the kitchen sees each child as a separate prep ticket; the customer pays the bundle's price)
        </span>
      </label>

      {isBundle && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">
            Add the items that make up this bundle. Each row is one component (e.g. 2× idly, 1× sambar, 1× filter coffee). Quantities multiply with the bundle order quantity.
          </p>

          {/* Customer-choice cap. 0 = all components ship; >0 = customer
              must pick exactly N of the rows below at order time. */}
          <div className="flex items-center gap-2 flex-wrap rounded-md bg-white border border-slate-200 px-3 py-2">
            <span className="text-xs font-semibold text-slate-700">Customer picks</span>
            <input
              type="number"
              min={0}
              max={Math.max(0, rows.filter((r) => r.childItemId).length)}
              value={maxPicks || ''}
              placeholder="0"
              onChange={(e) => setMaxPicks(Math.max(0, Number(e.target.value) || 0))}
              className="input text-xs w-16 text-center"
            />
            <span className="text-xs text-slate-600">
              of {rows.filter((r) => r.childItemId).length} component{rows.filter((r) => r.childItemId).length === 1 ? '' : 's'} below
            </span>
            <span className="text-[10px] text-slate-400">
              (leave 0 to include everything — set N to let customer choose any N of the rows)
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="text-xs italic text-slate-400">No components yet. Add at least one.</p>
          ) : (
            rows.map((row, idx) => {
              const selected = row.childItemId ? itemById.get(row.childItemId) : undefined;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={row.childItemId}
                    onChange={(e) => patchRow(idx, { childItemId: e.target.value, variantId: null })}
                    className="input text-xs flex-1"
                  >
                    <option value="">Pick an item…</option>
                    {flat.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                        {i.isBundle ? ' [bundle]' : ''}
                        {' · '}{i.subName}
                      </option>
                    ))}
                  </select>
                  {selected && selected.variants.length > 0 && (
                    <select
                      value={row.variantId || ''}
                      onChange={(e) => patchRow(idx, { variantId: e.target.value || null })}
                      className="input text-xs w-32"
                    >
                      <option value="">Default</option>
                      {selected.variants.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) => patchRow(idx, { quantity: Number(e.target.value) || 1 })}
                    className="input text-xs w-16 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                    title="Remove component"
                  >
                    <XIcon size={13} />
                  </button>
                </div>
              );
            })
          )}

          <button type="button" onClick={addRow} className="text-xs font-semibold text-brand-800 hover:text-brand-900 inline-flex items-center gap-1">
            <Plus size={12} /> Add component
          </button>
        </div>
      )}
    </div>
  );
}
