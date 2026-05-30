import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Minus, Plus, ShoppingCart, Clock } from 'lucide-react';
import api from '../services/api';
import {
  ClusterCartTopping, readClusterCart, writeClusterCart,
  makeClusterLineId, upsertLine,
} from '../utils/clusterCart';

// ── Same Item shape as the cluster bundle returns ──
interface DetailItem {
  id: string; name: string; basePrice: string | number;
  thumbnailUrl?: string | null; imageUrl?: string | null;
  shortDescription?: string | null; description?: string | null; longDescription?: string | null;
  foodGrade?: string; preparationTime?: number | null;
  isAvailable: boolean;
  variants?: Array<{ id: string; name: string; price: string | number; shortDescription?: string | null }>;
  images?: Array<{ id: string; url: string }>;
  itemToppings?: Array<{
    id: string; toppingId: string; isRequired: boolean; priceAdd?: string | number | null;
    topping: {
      id: string; name: string; basePriceAdd: string | number;
      options: Array<{ id: string; name: string; priceAdd: string | number }>;
    };
  }>;
}
interface DetailOutlet {
  id: string; name: string; publicCode: string | null;
}

const FOOD_GRADE_COLOR: Record<string, string> = { VEG: '#16a34a', NON_VEG: '#dc2626', VEGAN: '#0d9488' };
function FoodGradeDot({ grade }: { grade?: string }) {
  const color = FOOD_GRADE_COLOR[grade || 'VEG'];
  return (
    <span
      title={(grade || 'VEG').replace('_', '-')}
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: 14, height: 14, border: `2px solid ${color}`, borderRadius: 3 }}
    >
      <span style={{ width: 7, height: 7, background: color, borderRadius: '50%' }} />
    </span>
  );
}

export default function ClusterItemDetailPage() {
  const { publicCode, itemId } = useParams<{ publicCode: string; itemId: string }>();
  const [params] = useSearchParams();
  const outletId = params.get('outletId') || '';
  const navigate = useNavigate();

  // We fetch the full cluster bundle (one round trip we'd make anyway) and
  // pick the item by id from the requested outlet. This keeps prices and
  // toppings consistent with whatever the cluster shell sees.
  const [clusterId, setClusterId] = useState<string>('');
  const [item, setItem] = useState<DetailItem | null>(null);
  const [outlet, setOutlet] = useState<DetailOutlet | null>(null);
  const [loading, setLoading] = useState(true);

  const [variantId, setVariantId] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  // Topping selection — `selected` toggles the topping in/out, `optionId`
  // tracks which of the topping's options the user picked.
  const [topSel, setTopSel] = useState<Record<string, { selected: boolean; optionId?: string }>>({});

  useEffect(() => {
    if (!publicCode || !itemId || !outletId) return;
    api.get(`/clusters/by-code/${publicCode}`)
      .then(({ data }) => {
        const bundle = data.data ?? data;
        setClusterId(bundle.cluster?.id ?? '');
        const o = (bundle.outlets || []).find((oo: any) => oo.id === outletId);
        if (!o) { setItem(null); return; }
        setOutlet({ id: o.id, name: o.name, publicCode: o.publicCode });
        for (const c of o.categories || []) {
          for (const s of c.subcategories || []) {
            const found = (s.items || []).find((it: any) => it.id === itemId);
            if (found) { setItem(found); return; }
          }
        }
        setItem(null);
      })
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [publicCode, itemId, outletId]);

  // Init defaults when the item lands.
  useEffect(() => {
    if (!item) return;
    if (item.variants?.length && !variantId) setVariantId(item.variants[0].id);
    if (item.itemToppings?.length && Object.keys(topSel).length === 0) {
      const init: Record<string, { selected: boolean; optionId?: string }> = {};
      item.itemToppings.forEach((l) => {
        if (l.topping.options.length) {
          init[l.toppingId] = { selected: !!l.isRequired, optionId: l.isRequired ? l.topping.options[0].id : undefined };
        } else {
          init[l.toppingId] = { selected: !!l.isRequired };
        }
      });
      setTopSel(init);
    }
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live-priced cart-line preview.
  const { unitPrice, toppings, basePrice, variant } = useMemo(() => {
    if (!item) return { unitPrice: 0, toppings: [] as ClusterCartTopping[], basePrice: 0, variant: undefined as any };
    const variant = item.variants?.find((v) => v.id === variantId);
    const basePrice = variant ? Number(variant.price) : Number(item.basePrice);
    const out: ClusterCartTopping[] = [];
    for (const link of item.itemToppings || []) {
      const sel = topSel[link.toppingId];
      if (!sel?.selected && !link.isRequired) continue;
      const linkAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
      if (link.topping.options.length) {
        const optId = sel?.optionId || link.topping.options[0].id;
        const opt = link.topping.options.find((o) => o.id === optId);
        if (!opt) continue;
        out.push({
          toppingId: link.toppingId, optionId: opt.id,
          label: `${link.topping.name}: ${opt.name}`,
          priceAdd: linkAdd + Number(opt.priceAdd),
        });
      } else {
        out.push({ toppingId: link.toppingId, label: link.topping.name, priceAdd: linkAdd });
      }
    }
    const unitPrice = basePrice + out.reduce((s, t) => s + t.priceAdd, 0);
    return { unitPrice, toppings: out, basePrice, variant };
  }, [item, variantId, topSel]);

  const lineTotal = unitPrice * qty;

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!item || !outlet) {
    return <div className="p-6 text-sm text-slate-500">Item not found.</div>;
  }

  const gallery: string[] = [item.imageUrl, ...(item.images?.map((g) => g.url) || [])].filter(Boolean) as string[];

  const handleAdd = () => {
    if (!clusterId) return;
    const cartLineId = makeClusterLineId(outlet.id, item.id, variant?.id, toppings);
    const line = {
      cartLineId,
      outletId: outlet.id, outletName: outlet.name,
      itemId: item.id, itemName: item.name,
      variantId: variant?.id ?? null, variantName: variant?.name ?? null,
      unitPrice, quantity: 0,
      toppings: toppings.length ? toppings : undefined,
    };
    const prev = readClusterCart(clusterId);
    const next = upsertLine(prev, line, qty);
    writeClusterCart(clusterId, next);
    toast.success(`Added ${qty} × ${item.name}`);
    navigate(`/cluster/${publicCode}`);
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col pb-44">
      {/* Hero gallery + back button */}
      <div className="relative bg-white">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 z-10 w-9 h-9 bg-white/95 rounded-full flex items-center justify-center shadow"
        >
          <ArrowLeft size={16} />
        </button>
        {gallery.length > 0 ? (
          <img
            src={gallery[activeImage]}
            alt={item.name}
            className="w-full aspect-[4/3] object-cover"
          />
        ) : (
          <div className="w-full aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-6xl">🍽️</div>
        )}
        {gallery.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {gallery.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={'w-1.5 h-1.5 rounded-full transition-all ' + (i === activeImage ? 'bg-white w-4' : 'bg-white/50')}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Title + tagline + outlet */}
        <div>
          <div className="flex items-center gap-2">
            <FoodGradeDot grade={item.foodGrade} />
            <h1 className="text-xl font-black text-slate-900">{item.name}</h1>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">From <span className="font-semibold text-slate-600">{outlet.name}</span></p>
          {item.shortDescription && <p className="text-sm text-slate-600 mt-1.5">{item.shortDescription}</p>}
          {item.longDescription && item.longDescription !== item.shortDescription && (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.longDescription}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-lg font-black text-slate-900">₹{basePrice.toFixed(0)}</span>
            {item.preparationTime && (
              <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                <Clock size={11} /> {item.preparationTime} min
              </span>
            )}
          </div>
        </div>

        {/* Variants */}
        {item.variants && item.variants.length > 0 && (
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Choose a variant</p>
            <div className="space-y-2">
              {item.variants.map((v) => {
                const active = v.id === variantId;
                return (
                  <button
                    key={v.id}
                    onClick={() => setVariantId(v.id)}
                    className={
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ' +
                      (active
                        ? 'border-brand-500 bg-brand-50/60 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300')
                    }
                  >
                    <span className={'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ' + (active ? 'border-brand-500' : 'border-slate-300')}>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                    </span>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{v.name}</p>
                      {v.shortDescription && <p className="text-[11px] text-slate-400 truncate">{v.shortDescription}</p>}
                    </div>
                    <span className="text-sm font-bold text-slate-900">₹{Number(v.price).toFixed(0)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Toppings */}
        {item.itemToppings && item.itemToppings.length > 0 && (
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Add-ons</p>
            <div className="space-y-3">
              {item.itemToppings.map((link) => {
                const sel = topSel[link.toppingId] || { selected: link.isRequired };
                const linkAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
                const hasOptions = link.topping.options.length > 0;
                return (
                  <div key={link.toppingId} className="bg-white rounded-xl border border-slate-100 p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!sel.selected}
                        disabled={link.isRequired}
                        onChange={(e) =>
                          setTopSel((p) => ({
                            ...p,
                            [link.toppingId]: { selected: e.target.checked, optionId: p[link.toppingId]?.optionId },
                          }))
                        }
                        className="w-4 h-4 accent-brand-500"
                      />
                      <span className="text-sm font-semibold text-slate-800 flex-1">
                        {link.topping.name}
                        {link.isRequired && <span className="ml-1 text-[10px] text-red-500">required</span>}
                      </span>
                      {!hasOptions && (
                        <span className="text-xs font-bold text-slate-700">+₹{linkAdd.toFixed(0)}</span>
                      )}
                    </label>
                    {/* Options as radio group when present */}
                    {hasOptions && sel.selected && (
                      <div className="mt-2 ml-6 space-y-1.5">
                        {link.topping.options.map((opt) => (
                          <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`top-${link.toppingId}`}
                              checked={sel.optionId === opt.id}
                              onChange={() => setTopSel((p) => ({ ...p, [link.toppingId]: { selected: true, optionId: opt.id } }))}
                              className="accent-brand-500"
                            />
                            <span className="text-xs text-slate-700 flex-1">{opt.name}</span>
                            <span className="text-[11px] font-semibold text-slate-700">
                              +₹{(linkAdd + Number(opt.priceAdd)).toFixed(0)}
                            </span>
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

        {/* Quantity */}
        <section>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Quantity</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center"
            >
              <Minus size={14} />
            </button>
            <span className="text-lg font-bold w-10 text-center">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center"
            >
              <Plus size={14} />
            </button>
          </div>
        </section>
      </div>

      {/* Sticky add bar — sits ABOVE the global BottomNav (which is fixed at
          bottom-0 with z-40). Positioned at bottom-20 + z-50 so it clears
          the nav both vertically and in stacking order. */}
      <div className="fixed left-0 right-0 bottom-20 bg-white border-t border-slate-100 px-4 py-3 z-50 shadow-[0_-6px_18px_rgba(15,23,42,0.06)]">
        <button
          onClick={handleAdd}
          disabled={!item.isAvailable}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl inline-flex items-center justify-center gap-2"
        >
          <ShoppingCart size={16} />
          Add {qty} for ₹{lineTotal.toFixed(0)}
        </button>
      </div>
    </div>
  );
}
