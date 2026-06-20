import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plug, Copy, RefreshCw, CheckCircle2, AlertCircle, Power, Save,
} from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';

type Channel = 'ZOMATO' | 'SWIGGY' | 'UBER_EATS';

const CHANNELS: Array<{ id: Channel; label: string; brand: string; hint: string }> = [
  { id: 'ZOMATO',    label: 'Zomato',     brand: 'bg-rose-500',    hint: 'Restaurant Partner API · uses x-zomato-signature on webhooks' },
  { id: 'SWIGGY',    label: 'Swiggy',     brand: 'bg-orange-500',  hint: 'Restaurant Partner API · uses x-swiggy-signature on webhooks' },
  { id: 'UBER_EATS', label: 'Uber Eats',  brand: 'bg-slate-800',   hint: 'Marketplace API · uses x-uber-signature on webhooks' },
];

/**
 * Aggregator integration settings. Per channel, the operator captures
 * the per-restaurant credentials (an opaque JSON object — keys differ
 * per provider) plus the webhook secret, then enables the integration.
 *
 * The credentials JSON is encrypted server-side and never returned in
 * the list endpoint — the form starts blank on each load and only
 * pushes new values when the operator fills them in.
 */
export default function AggregatorsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const outletId = user?.outletId || '';
  const apiBase = (import.meta as any).env?.VITE_API_URL || '';

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-channel editable form state. Loaded from the list (for the
  // public-safe fields) + blank for the secrets so the operator
  // re-enters them when they want to rotate.
  const [forms, setForms] = useState<Record<Channel, {
    isActive: boolean;
    externalRestaurantId: string;
    credentials: string;
    webhookSecret: string;
    notes: string;
  }>>({} as any);

  const refresh = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/aggregators`);
      const list = data?.data ?? [];
      setRows(list);
      const byChannel: any = {};
      for (const ch of CHANNELS) {
        const r = list.find((x: any) => x.channel === ch.id);
        byChannel[ch.id] = {
          isActive: !!r?.isActive,
          externalRestaurantId: r?.externalRestaurantId ?? '',
          credentials: '',
          webhookSecret: '',
          notes: r?.notes ?? '',
        };
      }
      setForms(byChannel);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [outletId]);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async (ch: Channel) => {
    const form = forms[ch];
    if (!form) return;
    try {
      const body: any = {
        isActive: form.isActive,
        externalRestaurantId: form.externalRestaurantId || null,
        notes: form.notes || null,
      };
      // Only push secrets when the operator entered them — empty
      // strings mean "don't change", not "clear".
      if (form.credentials.trim()) {
        try {
          body.credentials = JSON.parse(form.credentials);
        } catch {
          toast.error('Credentials must be valid JSON');
          return;
        }
      }
      if (form.webhookSecret.trim()) {
        body.webhookSecret = form.webhookSecret.trim();
      }
      await api.put(`/outlets/${outletId}/aggregators/${ch}`, body);
      toast.success(`${ch} integration saved`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    }
  };

  const remove = async (ch: Channel) => {
    if (!window.confirm(`Remove the ${ch} integration? Credentials will be deleted.`)) return;
    try {
      await api.delete(`/outlets/${outletId}/aggregators/${ch}`);
      toast.success('Integration removed');
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Remove failed');
    }
  };

  if (!outletId) {
    return <div className="p-8 text-sm text-slate-500">Aggregator integrations are scoped per outlet.</div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Plug size={18} className="text-emerald-700" /> Aggregator integrations
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl">
            Connect Zomato, Swiggy, or Uber Eats so marketplace orders land directly on the kitchen display
            and status updates flow back automatically. Credentials are encrypted at rest. The actual API
            integrations are stubbed until credentials are configured — when an aggregator dashboard wants a
            webhook URL, copy the one shown on each card.
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={refresh}>
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      {loading ? (
        <div className="card p-12 text-center text-xs text-slate-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {CHANNELS.map((ch) => {
            const form = forms[ch.id];
            const row = rows.find((r: any) => r.channel === ch.id);
            const webhookUrl = `${apiBase}/webhooks/aggregator/${ch.id}/${outletId}`;
            if (!form) return null;
            return (
              <div key={ch.id} className="card">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                  <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center text-white', ch.brand)}>
                    <Plug size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{ch.label}</p>
                    <p className="text-[11px] text-slate-500">{ch.hint}</p>
                  </div>
                  <span className={clsx(
                    'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                    row?.isActive
                      ? 'bg-emerald-50 text-emerald-800'
                      : row
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-50 text-amber-800',
                  )}>
                    {row?.isActive
                      ? (<><CheckCircle2 size={10} /> ACTIVE</>)
                      : row
                        ? (<><Power size={10} /> CONFIGURED</>)
                        : (<><AlertCircle size={10} /> NOT CONFIGURED</>)}
                  </span>
                </div>

                <div className="px-4 py-3 space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Webhook URL</label>
                    <div className="flex items-center gap-1 mt-1">
                      <input value={webhookUrl} readOnly className="input text-[11px] font-mono" />
                      <button
                        onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copied'); }}
                        className="btn-secondary px-2"
                        title="Copy webhook URL"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Paste this into the {ch.label} dashboard.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">External restaurant ID</label>
                    <input
                      value={form.externalRestaurantId}
                      onChange={(e) => setForms((f) => ({ ...f, [ch.id]: { ...f[ch.id], externalRestaurantId: e.target.value } }))}
                      placeholder="From the partner dashboard"
                      className="input mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      Credentials JSON {row && <span className="text-slate-400 normal-case font-normal">(leave blank to keep)</span>}
                    </label>
                    <textarea
                      value={form.credentials}
                      onChange={(e) => setForms((f) => ({ ...f, [ch.id]: { ...f[ch.id], credentials: e.target.value } }))}
                      rows={3}
                      placeholder='{"api_key": "...", "client_id": "..."}'
                      className="input font-mono text-[11px] resize-none mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      Webhook secret {row && <span className="text-slate-400 normal-case font-normal">(leave blank to keep)</span>}
                    </label>
                    <input
                      type="password"
                      value={form.webhookSecret}
                      onChange={(e) => setForms((f) => ({ ...f, [ch.id]: { ...f[ch.id], webhookSecret: e.target.value } }))}
                      placeholder="HMAC shared secret"
                      className="input mt-1"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-700 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForms((f) => ({ ...f, [ch.id]: { ...f[ch.id], isActive: e.target.checked } }))}
                      />
                      Enabled
                    </label>
                    <div className="flex items-center gap-1">
                      {row && (
                        <button className="btn-secondary text-xs" onClick={() => remove(ch.id)}>Remove</button>
                      )}
                      <button className="btn-primary text-xs" onClick={() => save(ch.id)}>
                        <Save size={12} /> Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Item-to-channel mappings (external menu_item_id) are managed on the Menu page via a future
        "Mappings" tab. For now, the inbound webhook skips line items it can't map.
      </p>
    </div>
  );
}
