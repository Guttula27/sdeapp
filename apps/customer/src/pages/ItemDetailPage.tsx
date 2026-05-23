import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Clock, Minus, Plus, ShoppingCart, Heart } from 'lucide-react';
import api from '../services/api';

interface CartTopping { toppingId: string; optionId?: string; label: string; priceAdd: number; }
interface CartItem {
  cartLineId: string;
  itemId: string; variantId?: string;
  name: string; variantName?: string;
  price: number; quantity: number;
  toppings?: CartTopping[];
}

const FOOD_GRADE_COLOR: Record<string, string> = { VEG: '#16a34a', NON_VEG: '#dc2626', VEGAN: '#0d9488' };
function FoodGradeDot({ grade }: { grade?: string }) {
  const color = FOOD_GRADE_COLOR[grade || 'VEG'];
  return (
    <span className="inline-flex items-center justify-center shrink-0"
      style={{ width: 14, height: 14, border: `2px solid ${color}`, borderRadius: 3 }}>
      <span style={{ width: 7, height: 7, background: color, borderRadius: '50%' }} />
    </span>
  );
}

const makeLineId = (itemId: string, variantId: string | undefined, toppings: CartTopping[]) =>
  `${itemId}-${variantId || ''}-${toppings.map(t => `${t.toppingId}:${t.optionId || ''}`).sort().join('|')}`;

export default function ItemDetailPage() {
  const navigate = useNavigate();
  const { itemId } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const outletId = params.get('outlet') || (location.state as any)?.outletId;

  const passedItem = (location.state as any)?.item;
  const [item, setItem] = useState<any>(passedItem || null);
  const [loading, setLoading] = useState(!passedItem);
  const [variantId, setVariantId] = useState<string | ''>('');
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [topSel, setTopSel] = useState<Record<string, { selected: boolean; optionId?: string }>>({});

  // Load from menu if no state was passed
  useEffect(() => {
    if (passedItem || !outletId || !itemId) return;
    const tableId = params.get('table');
    api.get(`/outlets/${outletId}/menu`, { params: tableId ? { tableId } : {} }).then(({ data }) => {
      let found: any = null;
      for (const c of data.data || []) for (const s of c.subcategories || []) {
        const f = (s.items || []).find((it: any) => it.id === itemId);
        if (f) { found = f; break; }
      }
      setItem(found);
    }).finally(() => setLoading(false));
  }, [passedItem, outletId, itemId]);

  // Init defaults
  useEffect(() => {
    if (!item) return;
    if (item.variants?.length && !variantId) setVariantId(item.variants[0].id);
    if (item.itemToppings?.length && Object.keys(topSel).length === 0) {
      const init: Record<string, { selected: boolean; optionId?: string }> = {};
      item.itemToppings.forEach((l: any) => {
        if (l.topping.options.length) {
          init[l.toppingId] = { selected: !!l.isRequired, optionId: l.isRequired ? l.topping.options[0].id : undefined };
        } else {
          init[l.toppingId] = { selected: !!l.isRequired };
        }
      });
      setTopSel(init);
    }
  }, [item]); // eslint-disable-line

  if (loading) return <div className="min-h-dvh flex items-center justify-center"><div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!item) return <p className="p-6 text-sm text-slate-500">Item not found.</p>;

  const variant = item.variants?.find((v: any) => v.id === variantId);
  const basePrice = variant ? Number(variant.effectivePrice ?? variant.price) : Number(item.effectivePrice ?? item.basePrice);
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
  const unitPrice = basePrice + toppings.reduce((s, t) => s + t.priceAdd, 0);
  const lineTotal = unitPrice * qty;

  const gallery = [item.imageUrl, ...(item.images?.map((g: any) => g.url) || [])].filter(Boolean) as string[];

  const addToCart = () => {
    const cartLineId = makeLineId(item.id, variant?.id, toppings);
    const key = `cart-${outletId || ''}`;
    let existing: CartItem[] = [];
    try { existing = JSON.parse(sessionStorage.getItem(key) || '[]'); } catch {}
    const hit = existing.find(c => c.cartLineId === cartLineId);
    if (hit) hit.quantity += qty;
    else existing.push({
      cartLineId, itemId: item.id, variantId: variant?.id,
      name: item.name, variantName: variant?.name,
      price: unitPrice, quantity: qty,
      toppings: toppings.length ? toppings : undefined,
    });
    sessionStorage.setItem(key, JSON.stringify(existing));
    toast.success(`Added ${qty} × ${item.name}`);
    navigate(`/order?outlet=${outletId}`);
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* Hero gallery */}
      <div className="relative bg-white">
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 z-10 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow">
          <ArrowLeft size={16} />
        </button>
        <button
          onClick={async () => {
            const next = !item.isFavorite;
            setItem({ ...item, isFavorite: next });
            try {
              if (next) await api.post(`/users/me/favorites/${item.id}`);
              else      await api.delete(`/users/me/favorites/${item.id}`);
            } catch {
              setItem({ ...item, isFavorite: !next });
              toast.error('Failed to update favourite');
            }
          }}
          className="absolute top-3 right-14 z-10 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow"
          title={item.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Heart size={16} className={item.isFavorite ? 'text-red-500' : 'text-slate-400'} fill={item.isFavorite ? 'currentColor' : 'none'} />
        </button>
        {gallery.length > 0 ? (
          <>
            <img src={gallery[activeImage]} alt={item.name} className="w-full h-64 object-cover" />
            {gallery.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {gallery.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={clsx('w-2 h-2 rounded-full', i === activeImage ? 'bg-white' : 'bg-white/40')}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            <span className="text-6xl">🍽️</span>
          </div>
        )}
        {gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-3 py-2 bg-white border-t border-slate-100">
            {gallery.map((url, i) => (
              <button key={i} onClick={() => setActiveImage(i)}
                className={clsx('w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0',
                  i === activeImage ? 'border-brand-500' : 'border-slate-100')}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-5 py-4 space-y-4">
        {/* Heading */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <FoodGradeDot grade={item.foodGrade} />
            <h1 className="text-xl font-black text-slate-900">{item.name}</h1>
          </div>
          {item.shortDescription && (
            <p className="text-sm text-slate-500 mt-1">{item.shortDescription}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
            {item.preparationTime && <span className="flex items-center gap-1"><Clock size={10} /> {item.preparationTime} min</span>}
            {item.parcelAvailable ? <span>Parcel available</span> : <span className="text-red-500">Not available for parcel</span>}
          </div>
        </div>

        {item.longDescription && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">About</p>
            <p className="text-sm text-slate-700 leading-relaxed">{item.longDescription}</p>
          </div>
        )}

        {/* Variants */}
        {item.variants?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
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
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
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

        {/* Quantity */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Quantity</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><Minus size={14} /></button>
            <span className="w-6 text-center font-bold text-sm">{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="w-8 h-8 bg-brand-500 text-white rounded-lg flex items-center justify-center"><Plus size={14} /></button>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex items-center gap-3 shadow-[0_-2px_12px_rgba(0,0,0,.04)]">
        <div>
          <p className="text-[10px] text-slate-400">Total</p>
          <p className="text-lg font-black text-slate-900">₹{lineTotal.toFixed(0)}</p>
        </div>
        <button
          onClick={addToCart}
          className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-2xl text-sm font-bold shadow-md flex items-center justify-center gap-2"
        >
          <ShoppingCart size={15} /> Add {qty} to cart
        </button>
      </div>
    </div>
  );
}
