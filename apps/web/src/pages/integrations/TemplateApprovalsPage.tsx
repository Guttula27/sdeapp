import { useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Send, FileText, Building2, Store } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { STATUS_PILL, STATUS_LABEL } from './IntegrationsPage';

type ApprovalStatus = 'DRAFT' | 'PENDING_PLATFORM' | 'PENDING_PROVIDER' | 'APPROVED' | 'REJECTED';
type Pending = {
  id: string;
  name: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  scope: 'PLATFORM' | 'BUSINESS' | 'OUTLET';
  body: string;
  variables: string[];
  approvalStatus: ApprovalStatus;
  category: string;
  trigger?: string | null;
  business?: { id: string; name: string } | null;
  outlet?: { id: string; name: string } | null;
  submittedAt?: string | null;
};

type Provider = { id: string; channel: string; providerKey: string; providerName: string; isDefault: boolean };

export default function TemplateApprovalsPage() {
  const [items, setItems] = useState<Pending[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [forwardModal, setForwardModal] = useState<{ open: boolean; item?: Pending }>({ open: false });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; item?: Pending }>({ open: false });
  const [reason, setReason] = useState('');
  const [providerKey, setProviderKey] = useState('');
  const [providerTemplateId, setProviderTemplateId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [q, p] = await Promise.all([
        api.get('/message-templates/pending'),
        api.get('/integrations'),
      ]);
      setItems(q.data.data || []);
      setProviders(p.data.data || []);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const channelProviders = (ch: string) => providers.filter(p => p.channel === ch);

  const openForward = (item: Pending) => {
    const defaultP = channelProviders(item.channel).find(p => p.isDefault);
    setProviderKey(defaultP?.providerKey || channelProviders(item.channel)[0]?.providerKey || '');
    setProviderTemplateId('');
    setForwardModal({ open: true, item });
  };

  const doForward = async () => {
    if (!forwardModal.item || !providerKey) return;
    try {
      await api.post(`/message-templates/${forwardModal.item.id}/forward-to-provider`, {
        providerKey, providerTemplateId: providerTemplateId || undefined,
      });
      toast.success('Forwarded to provider');
      setForwardModal({ open: false });
      await load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const approve = async (item: Pending) => {
    try {
      await api.post(`/message-templates/${item.id}/approve`);
      toast.success('Approved');
      await load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const doReject = async () => {
    if (!rejectModal.item || !reason.trim()) return;
    try {
      await api.post(`/message-templates/${rejectModal.item.id}/reject`, { reason });
      toast.success('Rejected');
      setRejectModal({ open: false }); setReason('');
      await load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Template Approval Queue</h1>
        <p className="page-subtitle">Review templates submitted by businesses and outlets. Forward to provider when ready.</p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FileText size={32} className="text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium text-sm">No templates pending review</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((t) => (
              <li key={t.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="icon-wrap w-9 h-9 bg-brand-50 text-brand-600 shrink-0"><FileText size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{t.name}</span>
                      <span className="badge badge-slate text-[10px]">{t.channel}</span>
                      <span className={clsx('badge text-[10px]', STATUS_PILL[t.approvalStatus])}>{STATUS_LABEL[t.approvalStatus]}</span>
                      <span className="badge badge-orange text-[10px]">{t.category}</span>
                      {t.trigger && <span className="badge badge-blue text-[10px]">{t.trigger}</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      {t.business && <span className="flex items-center gap-1"><Building2 size={11} /> {t.business.name}</span>}
                      {t.outlet && <span className="flex items-center gap-1"><Store size={11} /> {t.outlet.name}</span>}
                      {t.submittedAt && <span>Submitted {new Date(t.submittedAt).toLocaleString()}</span>}
                    </p>
                    <pre className="text-xs text-slate-700 mt-2 whitespace-pre-wrap break-words bg-slate-50 rounded p-2 font-mono">{t.body}</pre>
                    {!!t.variables?.length && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.variables.map(v => <span key={v} className="text-[10px] font-mono bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {t.approvalStatus === 'PENDING_PLATFORM' && t.channel === 'WHATSAPP' && (
                      <button onClick={() => openForward(t)} className="btn-secondary text-xs py-1 px-2">
                        <Send size={11} /> Forward
                      </button>
                    )}
                    <button onClick={() => approve(t)} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded">
                      <CheckCircle2 size={12} /> Approve
                    </button>
                    <button onClick={() => setRejectModal({ open: true, item: t })} className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded">
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Forward modal */}
      <Modal open={forwardModal.open} onClose={() => setForwardModal({ open: false })} title="Forward to provider" size="md"
        footer={<>
          <button className="btn-secondary" onClick={() => setForwardModal({ open: false })}>Cancel</button>
          <button className="btn-primary" onClick={doForward} disabled={!providerKey}>Forward</button>
        </>}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Provider</label>
            <select className="input" value={providerKey} onChange={(e) => setProviderKey(e.target.value)}>
              <option value="">— select —</option>
              {forwardModal.item && channelProviders(forwardModal.item.channel).map(p => (
                <option key={p.id} value={p.providerKey}>{p.providerName} {p.isDefault ? '(default)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Provider Template ID (optional)</label>
            <input className="input font-mono" value={providerTemplateId} onChange={(e) => setProviderTemplateId(e.target.value)} placeholder="meta_xxxxxxxx" />
          </div>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal open={rejectModal.open} onClose={() => { setRejectModal({ open: false }); setReason(''); }} title="Reject template" size="md"
        footer={<>
          <button className="btn-secondary" onClick={() => { setRejectModal({ open: false }); setReason(''); }}>Cancel</button>
          <button className="btn-primary" onClick={doReject} disabled={!reason.trim()}>Reject</button>
        </>}>
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Reason</label>
        <textarea className="input min-h-[100px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell the author why this template was rejected…" />
      </Modal>
    </div>
  );
}
