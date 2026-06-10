import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  MessageCircle, MessageSquare, Mail, Plus, Trash2, Edit3, Send, FileText, AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { TemplateModal, STATUS_PILL, STATUS_LABEL } from '../integrations/IntegrationsPage';

type TemplateChannel = 'WHATSAPP' | 'SMS' | 'EMAIL';
type ApprovalStatus = 'DRAFT' | 'PENDING_PLATFORM' | 'PENDING_PROVIDER' | 'APPROVED' | 'REJECTED';

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
  rejectionReason?: string | null;
  providerTemplateId?: string | null;
};

const TABS: { key: TemplateChannel; label: string; icon: any; cls: string }[] = [
  { key: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle, cls: 'text-emerald-600 bg-emerald-50' },
  { key: 'SMS',      label: 'SMS',      icon: MessageSquare, cls: 'text-blue-600 bg-blue-50' },
  { key: 'EMAIL',    label: 'Email',    icon: Mail,          cls: 'text-purple-600 bg-purple-50' },
];

export default function MessagingPage() {
  const [tab, setTab] = useState<TemplateChannel>('WHATSAPP');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; existing?: Template }>({ open: false });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/message-templates');
      setTemplates(data.data || []);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Caller-scoped templates (BUSINESS or OUTLET) for the active channel
  const mine = useMemo(
    () => templates.filter(t => t.channel === tab && t.scope !== 'PLATFORM'),
    [templates, tab],
  );
  // Platform-provided boilerplate templates that the user can clone or just use as-is
  const platformPool = useMemo(
    () => templates.filter(t => t.channel === tab && t.scope === 'PLATFORM' && t.approvalStatus === 'APPROVED'),
    [templates, tab],
  );

  const save = async (dto: Partial<Template>) => {
    try {
      if (modal.existing) await api.patch(`/message-templates/${modal.existing.id}`, dto);
      else await api.post('/message-templates', dto);
      toast.success('Saved');
      setModal({ open: false });
      await load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const submit = async (id: string) => {
    try { await api.post(`/message-templates/${id}/submit`); toast.success('Submitted for approval'); await load(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try { await api.delete(`/message-templates/${id}`); toast.success('Deleted'); await load(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const cloneFromPlatform = (t: Template) => {
    setModal({ open: true, existing: { ...t, id: '', name: `${t.name}_copy`, scope: 'OUTLET', approvalStatus: 'DRAFT' } as Template });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Messaging Templates</h1>
        <p className="page-subtitle">Create WhatsApp, SMS and Email templates for order events and promotions. Templates are reviewed by platform admin before going live.</p>
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

      {/* My templates */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">My Templates</p>
            <p className="text-[11px] text-slate-500">Click submit when ready — the platform admin will review.</p>
          </div>
          <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setModal({ open: true })}>
            <Plus size={13} /> New Template
          </button>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}</div>
        ) : mine.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No templates yet — add one or clone from the boilerplate below.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mine.map((t) => (
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
                  {t.rejectionReason && (
                    <p className="text-[11px] text-red-600 mt-1.5 flex items-start gap-1">
                      <AlertCircle size={11} className="mt-0.5 shrink-0" />
                      <span><strong>Rejected:</strong> {t.rejectionReason}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {(t.approvalStatus === 'DRAFT' || t.approvalStatus === 'REJECTED') && (
                    <button onClick={() => submit(t.id)} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded">
                      <Send size={11} /> Submit
                    </button>
                  )}
                  {(t.approvalStatus === 'DRAFT' || t.approvalStatus === 'REJECTED') && (
                    <button className="btn-secondary text-xs py-1 px-2" onClick={() => setModal({ open: true, existing: t })}>
                      <Edit3 size={11} /> Edit
                    </button>
                  )}
                  <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Platform boilerplate */}
      {platformPool.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">Platform Boilerplate</p>
            <p className="text-[11px] text-slate-500">Pre-approved templates shipped by VEZEOR. Clone to customise.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {platformPool.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-start gap-3">
                <div className="icon-wrap w-9 h-9 bg-emerald-50 text-emerald-600 shrink-0"><FileText size={14} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{t.name}</span>
                    <span className="badge badge-green text-[10px]">Platform</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap break-words">{t.body}</p>
                </div>
                <button className="btn-secondary text-xs py-1 px-2" onClick={() => cloneFromPlatform(t)}>Clone</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TemplateModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        channel={tab}
        existing={modal.existing as any}
        onSave={save}
      />
    </div>
  );
}
