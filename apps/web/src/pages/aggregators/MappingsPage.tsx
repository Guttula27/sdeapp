import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ArrowLeft, Plug, Search, Save, Trash2, RefreshCw, Power } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RootState } from '../../store';
import api from '../../services/api';

type Channel = 'ZOMATO' | 'SWIGGY' | 'UBER_EATS';
const CHANNELS: Array<{ id: Channel; label: string; brand: string }> = [
  { id: 'ZOMATO',    label: 'Zomato',    brand: 'text-rose-700' },
  { id: 'SWIGGY',    label: 'Swiggy',    brand: 'text-orange-700' },
  { id: 'UBER_EATS', label: 'Uber Eats', brand: 'text-slate-800' },
];

type ItemRow = {
  id: string;
  name: string;
  basePrice: number | string;
  isAvailable: boolean;
  subcategory: { id: string; name: string; category: { id: string; name: string; displayOrder: number } };
  aggregatorMappings: Array<{
    id: string;
    channel: Channel;
    externalItemId: string;
    externalPrice: number | string | null;
    isEnabled: boolean;
  }>;
};

type Draft = {
  externalItemId: string;
  externalPrice: string;
  isEnabled: boolean;
  dirty: boolean;
  saving: boolean;
};

/**
 * Bulk item ↔ aggregator-ID mapping table. Items down the left, one
 * column per channel. Operator types the external IDs from each
 * provider's dashboard against the rows they care about; a row is
 * saved when the operator clicks Save or tabs to the next field
 * (debounced auto-save would be nice but adds complexity around
 * partial writes; explicit Save keeps the intent visible).
 *
 * Active channels (those toggled on under /aggregators) are shown
 * first and prominently — inactive channels are dimmed but still
 * editable so the operator can pre-fill before flipping the switch.
 */
export default function MappingsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const outletId = user?.outletId || '';

  const [items, setItems] = useState<ItemRow[]>([]);
  const [activeChannels, setActiveChannels] = useState<Set<Channel>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);

  // Per-cell editing state, keyed `${itemId}|${channel}`. Holds the
  // operator's typed value until they Save it; on save we round-trip
  // and update the row's persisted mapping, dropping the draft.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const refresh = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const [mappingsRes, integrationsRes] = await Promise.all([
        api.get(`/outlets/${outletId}/aggregators-mappings/items`),
        api.get(`/outlets/${outletId}/aggregators`),
      ]);
      setItems(mappingsRes.data?.data ?? []);
      const active = new Set<Channel>();
      for (const i of integrationsRes.data?.data ?? []) {
        if (i.isActive && i.channel !== 'DIRECT') active.add(i.channel);
      }
      setActiveChannels(active);
      setDrafts({});
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }, [outletId]);
  useEffect(() => { refresh(); }, [refresh]);

  const draftKey = (itemId: string, channel: Channel) => `${itemId}|${channel}`;
  const getMapping = (item: ItemRow, channel: Channel) =>
    item.aggregatorMappings.find((m) => m.channel === channel);

  // Pull the active value for a cell — draft if the operator is
  // editing, otherwise the persisted mapping.
  const cellValue = (item: ItemRow, channel: Channel) => {
    const key = draftKey(item.id, channel);
    const d = drafts[key];
    if (d) return d;
    const m = getMapping(item, channel);
    return {
      externalItemId: m?.externalItemId ?? '',
      externalPrice: m?.externalPrice != null ? String(m.externalPrice) : '',
      isEnabled: m?.isEnabled ?? true,
      dirty: false,
      saving: false,
    };
  };

  const setDraft = (item: ItemRow, channel: Channel, patch: Partial<Draft>) => {
    const key = draftKey(item.id, channel);
    const current = cellValue(item, channel);
    setDrafts((d) => ({ ...d, [key]: { ...current, ...patch, dirty: true } }));
  };

  const saveCell = async (item: ItemRow, channel: Channel) => {
    const key = draftKey(item.id, channel);
    const draft = drafts[key];
    if (!draft || !draft.dirty) return;
    if (!draft.externalItemId.trim()) {
      toast.error('External ID is required to save');
      return;
    }
    setDrafts((d) => ({ ...d, [key]: { ...d[key], saving: true } }));
    try {
      const body: any = {
        externalItemId: draft.externalItemId.trim(),
        isEnabled: draft.isEnabled,
      };
      if (draft.externalPrice.trim()) {
        const n = Number(draft.externalPrice);
        if (Number.isNaN(n) || n < 0) throw new Error('External price must be a non-negative number');
        body.externalPrice = n;
      } else {
        body.externalPrice = null;
      }
      const { data } = await api.put(
        `/outlets/${outletId}/aggregators-mappings/items/${item.id}/${channel}`,
        body,
      );
      const saved = data?.data;
      // Patch the row in place so the table doesn't blink — reusing
      // the saved mapping's externalItemId / externalPrice / isEnabled.
      setItems((rows) => rows.map((r) => {
        if (r.id !== item.id) return r;
        const others = r.aggregatorMappings.filter((m) => m.channel !== channel);
        return {
          ...r,
          aggregatorMappings: [
            ...others,
            saved ?? {
              id: '',
              channel,
              externalItemId: draft.externalItemId.trim(),
              externalPrice: body.externalPrice,
              isEnabled: draft.isEnabled,
            },
          ],
        };
      }));
      setDrafts((d) => {
        const { [key]: _, ...rest } = d;
        return rest;
      });
      toast.success(`Saved ${item.name} → ${channel}`);
    } catch (e: any) {
      setDrafts((d) => ({ ...d, [key]: { ...d[key], saving: false } }));
      toast.error(e?.response?.data?.message || e?.message || 'Save failed');
    }
  };

  const removeCell = async (item: ItemRow, channel: Channel) => {
    const m = getMapping(item, channel);
    if (!m) {
      // Just clear the draft.
      const key = draftKey(item.id, channel);
      setDrafts((d) => { const { [key]: _, ...rest } = d; return rest; });
      return;
    }
    if (!window.confirm(`Remove the ${channel} mapping for ${item.name}?`)) return;
    try {
      await api.delete(`/outlets/${outletId}/aggregators-mappings/items/${item.id}/${channel}`);
      setItems((rows) => rows.map((r) => r.id === item.id
        ? { ...r, aggregatorMappings: r.aggregatorMappings.filter((mm) => mm.channel !== channel) }
        : r));
      toast.success('Mapping removed');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Remove failed');
    }
  };

  // Filter pipeline.
  const filtered = useMemo(() => {
    let rows = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(q)
        || r.subcategory.name.toLowerCase().includes(q)
        || r.subcategory.category.name.toLowerCase().includes(q),
      );
    }
    if (showOnlyUnmapped) {
      // "Unmapped" = missing a mapping on at least one ACTIVE channel.
      // If no channels are active, treat as "missing at least one of
      // any channel" so the operator can still find rows to fill.
      const channels = activeChannels.size > 0 ? Array.from(activeChannels) : CHANNELS.map((c) => c.id);
      rows = rows.filter((r) => channels.some((c) => !r.aggregatorMappings.find((m) => m.channel === c)));
    }
    return rows;
  }, [items, search, showOnlyUnmapped, activeChannels]);

  if (!outletId) {
    return <div className="p-8 text-sm text-slate-500">Aggregator mappings are scoped per outlet.</div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Link to="/aggregators" className="text-slate-500 hover:text-slate-800">
              <ArrowLeft size={18} />
            </Link>
            <Plug size={18} className="text-emerald-700" /> Item mappings
          </h1>
          <p className="text-xs text-slate-500 max-w-3xl">
            Paste the external item IDs each aggregator uses for these dishes. Unmapped items are skipped
            on inbound webhooks. Per-channel price overrides are optional — when set, they're what the
            marketplace charges (useful when commissions force a bumped price).
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={refresh}>
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item, subcategory, or category…"
            className="input pl-8 text-sm"
          />
        </div>
        <label className="text-[11px] text-slate-700 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyUnmapped}
            onChange={(e) => setShowOnlyUnmapped(e.target.checked)}
          />
          Show only unmapped
        </label>
        <div className="ml-auto text-[11px] text-slate-500">
          {filtered.length}/{items.length} items · {activeChannels.size} active channel{activeChannels.size === 1 ? '' : 's'}
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-xs text-slate-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-sm text-slate-500">
          No items yet — add items on the Menu page before mapping them.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[1100px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left  font-semibold px-3 py-2.5 w-[260px]">Item</th>
                {CHANNELS.map((ch) => {
                  const isActive = activeChannels.has(ch.id);
                  return (
                    <th key={ch.id} className="text-left font-semibold px-3 py-2.5">
                      <span className={clsx('inline-flex items-center gap-1.5', ch.brand)}>
                        <Plug size={11} />
                        {ch.label}
                        {!isActive && <span className="ml-1 text-[9px] font-normal text-slate-400">(inactive)</span>}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-900 text-sm">{item.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {item.subcategory.category.name} / {item.subcategory.name}
                    </div>
                    <div className="text-[11px] tabular-nums text-slate-600 mt-0.5">
                      ₹{Number(item.basePrice).toFixed(2)}
                      {!item.isAvailable && <span className="ml-2 text-rose-600">Out of stock</span>}
                    </div>
                  </td>
                  {CHANNELS.map((ch) => {
                    const cell = cellValue(item, ch.id);
                    const isActive = activeChannels.has(ch.id);
                    const mapping = getMapping(item, ch.id);
                    // When the channel's integration is inactive the
                    // mapping is dark — server-side resolveItemId
                    // already returns null for inactive channels, so
                    // showing editable inputs here would just confuse
                    // the operator into thinking unmapped items will
                    // route. Disable input + show clear callout
                    // pointing them at /aggregators to turn the
                    // channel on. Existing mappings stay visible so
                    // the data isn't lost.
                    if (!isActive) {
                      return (
                        <td key={ch.id} className="px-3 py-2.5 opacity-60">
                          {mapping ? (
                            <>
                              <div className="text-[11px] font-mono text-slate-500 truncate" title={mapping.externalItemId}>
                                {mapping.externalItemId}
                              </div>
                              {mapping.externalPrice != null && (
                                <div className="text-[10px] tabular-nums text-slate-400">
                                  ₹{Number(mapping.externalPrice).toFixed(2)}
                                </div>
                              )}
                              <div className="text-[9px] uppercase tracking-wider text-amber-700 mt-1">
                                Channel off — won't route
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic">
                              Activate {ch.label} on the Aggregators page to map items.
                            </div>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td key={ch.id} className="px-3 py-2.5">
                        <div className="flex items-stretch gap-1">
                          <div className="flex-1 min-w-0 space-y-1">
                            <input
                              value={cell.externalItemId}
                              onChange={(e) => setDraft(item, ch.id, { externalItemId: e.target.value })}
                              placeholder="External ID"
                              className="input text-[11px] font-mono py-1"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={cell.externalPrice}
                                onChange={(e) => setDraft(item, ch.id, { externalPrice: e.target.value })}
                                placeholder="Override ₹"
                                className="input text-[11px] py-1 flex-1 tabular-nums"
                              />
                              <button
                                type="button"
                                onClick={() => setDraft(item, ch.id, { isEnabled: !cell.isEnabled })}
                                className={clsx(
                                  'text-[10px] font-bold px-1.5 py-1 rounded-md border transition-colors shrink-0',
                                  cell.isEnabled
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-slate-100 border-slate-200 text-slate-500',
                                )}
                                title={cell.isEnabled ? 'Enabled on this channel' : 'Hidden on this channel'}
                              >
                                <Power size={10} />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col items-stretch gap-1">
                            <button
                              type="button"
                              onClick={() => saveCell(item, ch.id)}
                              disabled={!cell.dirty || cell.saving}
                              className={clsx(
                                'inline-flex items-center justify-center px-1.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                                cell.dirty
                                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                                  : 'bg-slate-100 text-slate-400',
                              )}
                              title="Save mapping"
                            >
                              <Save size={11} />
                            </button>
                            {mapping && (
                              <button
                                type="button"
                                onClick={() => removeCell(item, ch.id)}
                                className="inline-flex items-center justify-center px-1.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                                title="Remove mapping"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Tip: get the external IDs from each provider's restaurant-partner dashboard. They usually appear
        on the menu / item details page once you've onboarded the restaurant.
      </p>
    </div>
  );
}
