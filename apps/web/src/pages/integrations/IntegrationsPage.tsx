import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  MessageCircle, MessageSquare, Mail, CreditCard, Plus, Trash2,
  CheckCircle2, Star, FileText, Send, Edit3,
} from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

type Channel = 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PAYMENT_GATEWAY';
type TemplateChannel = 'WHATSAPP' | 'SMS' | 'EMAIL';
type ApprovalStatus = 'DRAFT' | 'PENDING_PLATFORM' | 'PENDING_PROVIDER' | 'APPROVED' | 'REJECTED';

type IntegrationConfig = {
  id: string;
  channel: Channel;
  providerKey: string;
  providerName: string;
  isDefault: boolean;
  isActive: boolean;
  config: Record<string, any>;
};

type Template = {
  id: string;
  channel: TemplateChannel;
  scope: 'PLATFORM' | 'BUSINESS' | 'OUTLET';
  name: string;
  body: string;
  category: string;
  approvalStatus: ApprovalStatus;
  variables: string[];
  language: string;
  trigger?: string | null;
  providerKey?: string | null;
  rejectionReason?: string | null;
  business?: { id: string; name: string } | null;
  outlet?: { id: string; name: string } | null;
};

/* ── tab definitions ──────────────────────────────────────── */
const TABS: { key: Channel; label: string; icon: any; cls: string }[] = [
  { key: 'WHATSAPP',        label: 'WhatsApp',        icon: MessageCircle, cls: 'text-emerald-600 bg-emerald-50' },
  { key: 'SMS',             label: 'SMS',             icon: MessageSquare, cls: 'text-blue-600 bg-blue-50' },
  { key: 'EMAIL',           label: 'Email',           icon: Mail,          cls: 'text-purple-600 bg-purple-50' },
  { key: 'PAYMENT_GATEWAY', label: 'Payment Gateways', icon: CreditCard,    cls: 'text-amber-600 bg-amber-50' },
];

/* Channel-specific credential field hints — kept lightweight; admins enter raw values. */
const CONFIG_FIELDS: Record<Channel, { key: string; label: string; type?: 'text' | 'password' }[]> = {
  WHATSAPP:        [{ key: 'apiKey', label: 'API Key', type: 'password' }, { key: 'phoneNumberId', label: 'Phone Number ID' }, { key: 'wabaId', label: 'WABA ID' }],
  SMS:             [{ key: 'apiKey', label: 'API Key', type: 'password' }, { key: 'senderId', label: 'Sender ID' }],
  EMAIL:           [{ key: 'apiKey', label: 'API Key', type: 'password' }, { key: 'fromEmail', label: 'From Email' }, { key: 'fromName', label: 'From Name' }],
  PAYMENT_GATEWAY: [{ key: 'keyId', label: 'Key ID' }, { key: 'keySecret', label: 'Key Secret', type: 'password' }, { key: 'webhookSecret', label: 'Webhook Secret', type: 'password' }],
};

const STATUS_PILL: Record<ApprovalStatus, string> = {
  DRAFT:            'bg-slate-100 text-slate-600',
  PENDING_PLATFORM: 'bg-amber-100 text-amber-700',
  PENDING_PROVIDER: 'bg-indigo-100 text-indigo-700',
  APPROVED:         'bg-emerald-100 text-emerald-700',
  REJECTED:         'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  DRAFT:            'Draft',
  PENDING_PLATFORM: 'Pending Review',
  PENDING_PROVIDER: 'With Provider',
  APPROVED:         'Approved',
  REJECTED:         'Rejected',
};

/* ── main page ────────────────────────────────────────────── */
export default function IntegrationsPage() {
  const [tab, setTab] = useState<Channel>('WHATSAPP');
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  const [providerModal, setProviderModal] = useState<{ open: boolean; existing?: IntegrationConfig }>({ open: false });
  const [templateModal, setTemplateModal] = useState<{ open: boolean; existing?: Template }>({ open: false });

  const channelConfigs = useMemo(() => configs.filter(c => c.channel === tab), [configs, tab]);
  const isTemplateTab = tab !== 'PAYMENT_GATEWAY';
  const channelTemplates = useMemo(
    () => templates.filter(t => isTemplateTab && t.channel === (tab as TemplateChannel)),
    [templates, tab, isTemplateTab],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([
        api.get('/integrations'),
        api.get('/message-templates', { params: { scope: 'PLATFORM' } }),
      ]);
      setConfigs(c.data.data || []);
      setTemplates(t.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const saveProvider = async (dto: Partial<IntegrationConfig>) => {
    try {
      await api.post('/integrations', { channel: tab, ...dto });
      toast.success('Saved');
      setProviderModal({ open: false });
      await load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const setDefault = async (id: string) => {
    try {
      await api.post(`/integrations/${id}/default`);
      toast.success('Marked as default');
      await load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const removeProvider = async (id: string) => {
    if (!confirm('Remove this provider configuration?')) return;
    try {
      await api.delete(`/integrations/${id}`);
      toast.success('Removed');
      await load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const saveTemplate = async (dto: Partial<Template>) => {
    try {
      if (templateModal.existing) {
        await api.patch(`/message-templates/${templateModal.existing.id}`, dto);
      } else {
        await api.post('/message-templates', { ...dto, scope: 'PLATFORM' });
      }
      toast.success('Saved');
      setTemplateModal({ open: false });
      await load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const submitTemplate = async (id: string) => {
    try { await api.post(`/message-templates/${id}/submit`); toast.success('Submitted for approval'); await load(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const removeTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try { await api.delete(`/message-templates/${id}`); toast.success('Deleted'); await load(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Third-Party Integrations</h1>
        <p className="page-subtitle">Configure messaging providers, payment gateways and platform-level templates</p>
      </div>

      {/* tabs */}
      <div className="card p-1 inline-flex gap-1 flex-wrap">
        {TABS.map(({ key, label, icon: Icon, cls }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors',
                active ? cls : 'text-slate-500 hover:bg-slate-50',
              )}>
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>

      {/* Providers card */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Configured Providers</p>
            <p className="text-[11px] text-slate-500">Mark one as default — used by the system unless overridden per-message.</p>
          </div>
          <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setProviderModal({ open: true })}>
            <Plus size={13} /> Add Provider
          </button>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div>
        ) : channelConfigs.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No providers configured yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {channelConfigs.map((c) => (
              <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{c.providerName}</span>
                    <span className="text-[11px] font-mono text-slate-400">{c.providerKey}</span>
                    {c.isDefault && <span className="badge badge-green text-[10px] flex items-center gap-1"><Star size={9} /> Default</span>}
                    {!c.isActive && <span className="badge badge-slate text-[10px]">Inactive</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {Object.entries(c.config || {}).filter(([, v]) => v).map(([k]) => k).join(' · ') || 'No credentials set'}
                  </p>
                </div>
                <button className="btn-secondary text-xs py-1 px-2" onClick={() => setProviderModal({ open: true, existing: c })}>
                  <Edit3 size={12} /> Edit
                </button>
                {!c.isDefault && (
                  <button onClick={() => setDefault(c.id)} className="text-[11px] font-semibold text-emerald-600 hover:underline">
                    Set default
                  </button>
                )}
                <button onClick={() => removeProvider(c.id)} className="text-slate-400 hover:text-red-500 p-1">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Platform templates — only for messaging channels */}
      {isTemplateTab && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">Platform Templates</p>
              <p className="text-[11px] text-slate-500">Boilerplate templates available to every business. Submit for provider approval to use in production.</p>
            </div>
            <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setTemplateModal({ open: true })}>
              <Plus size={13} /> New Template
            </button>
          </div>
          {channelTemplates.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">No templates yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {channelTemplates.map((t) => (
                <li key={t.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="icon-wrap w-9 h-9 bg-brand-50 text-brand-600 shrink-0"><FileText size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm truncate">{t.name}</span>
                      <span className={clsx('badge text-[10px]', STATUS_PILL[t.approvalStatus])}>{STATUS_LABEL[t.approvalStatus]}</span>
                      <span className="badge badge-slate text-[10px]">{t.category}</span>
                      {t.trigger && <span className="badge badge-blue text-[10px]">{t.trigger}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap break-words">{t.body}</p>
                    {!!t.variables?.length && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.variables.map(v => <span key={v} className="text-[10px] font-mono bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>)}
                      </div>
                    )}
                    {t.rejectionReason && <p className="text-[11px] text-red-600 mt-1.5">Rejected: {t.rejectionReason}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {(t.approvalStatus === 'DRAFT' || t.approvalStatus === 'REJECTED') && (
                      <button onClick={() => submitTemplate(t.id)} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded">
                        <Send size={11} /> Submit
                      </button>
                    )}
                    <button className="btn-secondary text-xs py-1 px-2" onClick={() => setTemplateModal({ open: true, existing: t })}>
                      <Edit3 size={11} /> Edit
                    </button>
                    <button onClick={() => removeTemplate(t.id)} className="text-slate-400 hover:text-red-500 p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ProviderModal
        open={providerModal.open}
        onClose={() => setProviderModal({ open: false })}
        channel={tab}
        existing={providerModal.existing}
        onSave={saveProvider}
      />
      <TemplateModal
        open={templateModal.open}
        onClose={() => setTemplateModal({ open: false })}
        channel={isTemplateTab ? (tab as TemplateChannel) : 'WHATSAPP'}
        existing={templateModal.existing}
        onSave={saveTemplate}
      />
    </div>
  );
}

/* ── Provider modal ───────────────────────────────────────── */
function ProviderModal({ open, onClose, channel, existing, onSave }: {
  open: boolean; onClose: () => void; channel: Channel;
  existing?: IntegrationConfig;
  onSave: (dto: Partial<IntegrationConfig>) => void;
}) {
  const [providerKey, setProviderKey] = useState('');
  const [providerName, setProviderName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existing) {
      setProviderKey(existing.providerKey);
      setProviderName(existing.providerName);
      setIsDefault(existing.isDefault);
      setConfig(existing.config || {});
    } else {
      setProviderKey(''); setProviderName(''); setIsDefault(false); setConfig({});
    }
  }, [existing, open]);

  const fields = CONFIG_FIELDS[channel];

  return (
    <Modal open={open} onClose={onClose} title={existing ? `Edit provider` : `Add ${channel.replace('_', ' ').toLowerCase()} provider`} size="md"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave({ providerKey, providerName, isDefault, config })}
          disabled={!providerKey.trim() || !providerName.trim()}>Save</button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider Key (uppercase, unique)">
            <input className="input font-mono" value={providerKey} onChange={(e) => setProviderKey(e.target.value.toUpperCase())} placeholder="GUPSHUP" disabled={!!existing} />
          </Field>
          <Field label="Display Name">
            <input className="input" value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Gupshup" />
          </Field>
        </div>
        {fields.map(f => (
          <Field key={f.key} label={f.label}>
            <input
              type={f.type || 'text'}
              className="input font-mono"
              value={config[f.key] ?? ''}
              onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
              placeholder={f.label}
            />
          </Field>
        ))}

        {/* Payment-gateway-only: per-mode surcharge editor. Stored inside the
            provider's opaque `config.charges` map, since each gateway uses a
            different shape and this lets us avoid a dedicated table. */}
        {channel === 'PAYMENT_GATEWAY' && (
          <GatewayChargesEditor
            value={(config as any).charges || {}}
            onChange={(charges) => setConfig({ ...config, charges } as any)}
          />
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="accent-brand-500" />
          Mark as default provider for this channel
        </label>
      </div>
    </Modal>
  );
}

/* ── Gateway charges editor ───────────────────────────────── */
const GATEWAY_MODES = [
  { key: 'UPI',         label: 'UPI' },
  { key: 'DEBIT_CARD',  label: 'Debit Card' },
  { key: 'CREDIT_CARD', label: 'Credit Card' },
  { key: 'NET_BANKING', label: 'Net Banking' },
  { key: 'WALLET',      label: 'Wallet' },
];

function GatewayChargesEditor({ value, onChange }: {
  value: Record<string, number | string>;
  onChange: (next: Record<string, number>) => void;
}) {
  const update = (key: string, raw: string) => {
    const n = raw === '' ? 0 : Number(raw);
    onChange({
      ...Object.fromEntries(GATEWAY_MODES.map((m) => [m.key, Number(value[m.key] ?? 0)])),
      [key]: isFinite(n) ? n : 0,
    });
  };
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <div>
        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Gateway charges (%)</p>
        <p className="text-[11px] text-amber-700/80">
          Surcharge applied on top of the order total when a customer chooses payment gateway.
          Leave blank or 0 for no extra charge.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {GATEWAY_MODES.map((m) => (
          <label key={m.key} className="flex items-center justify-between gap-2 bg-white border border-amber-100 rounded-lg px-2.5 py-1.5">
            <span className="text-xs font-semibold text-slate-700">{m.label}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={value[m.key] ?? ''}
                onChange={(e) => update(m.key, e.target.value)}
                placeholder="0"
                className="w-16 text-right bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs font-mono"
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ── Template modal (reused by messaging page too — kept local for now) ── */
const COMMON_VARS = ['customer_name', 'item', 'price', 'discount', 'datetime', 'order_id', 'outlet_name'];

function TemplateModal({ open, onClose, channel, existing, onSave }: {
  open: boolean; onClose: () => void; channel: TemplateChannel;
  existing?: Template;
  onSave: (dto: Partial<Template>) => void;
}) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('TRANSACTIONAL');
  const [trigger, setTrigger] = useState<string>('');
  const [language, setLanguage] = useState('en');
  const [ch, setCh] = useState<TemplateChannel>(channel);

  useEffect(() => {
    if (existing) {
      setName(existing.name); setBody(existing.body); setCategory(existing.category);
      setTrigger(existing.trigger || ''); setLanguage(existing.language || 'en'); setCh(existing.channel);
    } else {
      setName(''); setBody(''); setCategory('TRANSACTIONAL'); setTrigger(''); setLanguage('en'); setCh(channel);
    }
  }, [existing, channel, open]);

  const insertVar = (v: string) => setBody((b) => `${b}{{${v}}}`);

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit template' : 'New template'} size="lg"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave({ name, body, category: category as any, trigger: trigger || undefined, language, channel: ch })}
          disabled={!name.trim() || !body.trim()}>Save</button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Template Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="order_placed_confirmation" />
          </Field>
          <Field label="Channel">
            <select className="input" value={ch} onChange={(e) => setCh(e.target.value as TemplateChannel)}>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
            </select>
          </Field>
          <Field label="Category">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="TRANSACTIONAL">Transactional</option>
              <option value="PROMOTIONAL">Promotional</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTH">Auth / OTP</option>
            </select>
          </Field>
          <Field label="Trigger (optional)">
            <input className="input font-mono" value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="ORDER_PLACED" />
          </Field>
        </div>
        <Field label="Body">
          <textarea
            className="input min-h-[140px] font-mono text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi {{customer_name}}, your order {{order_id}} of ₹{{price}} is placed."
          />
        </Field>
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Insert variable</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_VARS.map(v => (
              <button key={v} type="button" onClick={() => insertVar(v)}
                className="text-[11px] font-mono bg-violet-50 text-violet-700 hover:bg-violet-100 px-2 py-1 rounded">
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

export { TemplateModal, STATUS_PILL, STATUS_LABEL };
