import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Plus, Languages as LangIcon, Trash2, Lock, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  isEnabled: boolean;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

export default function LanguagesPage() {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Language | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/languages/all');
      setLanguages(data.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggle = async (lang: Language) => {
    try {
      const { data } = await api.patch(`/languages/${lang.code}`, { isEnabled: !lang.isEnabled });
      setLanguages((ls) => ls.map((l) => (l.code === lang.code ? data.data : l)));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update');
    }
  };

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const { data } = await api.post('/languages', {
        code: form.get('code'),
        name: form.get('name'),
        nativeName: form.get('nativeName'),
      });
      setLanguages((ls) => [...ls, data.data]);
      setModal(false);
      toast.success(
        'Language added — translations are being generated in the background. Refresh in a minute.',
        { duration: 6000 },
      );
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to add language');
    } finally { setSaving(false); }
  };

  const regenerate = async (lang: Language) => {
    try {
      await api.post(`/languages/${lang.code}/regenerate`);
      toast.success(
        `Regenerating ${lang.name} translations — check API logs for progress.`,
        { duration: 6000 },
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to start regeneration');
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/languages/${deleteTarget.code}`);
      setLanguages((ls) => ls.filter((l) => l.code !== deleteTarget.code));
      setDeleteTarget(null);
      toast.success('Language removed');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to remove');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">{t('languages.title')}</h1>
          <p className="page-subtitle">{t('languages.subtitle')}</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus size={15} /> {t('languages.addLanguage')}
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-400">{t('common.loading')}</p>
        ) : languages.length === 0 ? (
          <div className="p-12 text-center">
            <LangIcon size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500">No languages yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3">{t('languages.code')}</th>
                <th className="px-5 py-3">{t('languages.name')}</th>
                <th className="px-5 py-3">{t('languages.nativeName')}</th>
                <th className="px-5 py-3">{t('common.enabled')}</th>
                <th className="px-5 py-3 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {languages.map((l) => (
                <tr key={l.code} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-mono text-slate-700">{l.code}</td>
                  <td className="px-5 py-3 text-slate-900">{l.name}</td>
                  <td className="px-5 py-3 text-slate-700">{l.nativeName}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggle(l)}
                      disabled={l.code === 'en'}
                      className={`text-xs font-semibold px-2 py-1 rounded-md ${
                        l.isEnabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      } ${l.code === 'en' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-emerald-200'}`}
                    >
                      {l.isEnabled ? t('common.enabled') : t('common.disabled')}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {l.code === 'en' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Lock size={10} /> source
                      </span>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => regenerate(l)}
                          disabled={!l.isEnabled}
                          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:bg-brand-50 px-2 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                          title={l.isEnabled ? 'Re-run translation backfill for every existing entity' : 'Enable the language first'}
                        >
                          <RefreshCw size={12} /> Regenerate
                        </button>
                        <button
                          onClick={() => setDeleteTarget(l)}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-md"
                        >
                          <Trash2 size={12} /> {t('common.delete')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={t('languages.newLanguage')}
        subtitle={t('languages.createDesc')}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(false)}>{t('common.cancel')}</button>
            <button form="lang-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {t('common.create')}
            </button>
          </>
        }
      >
        <form id="lang-form" onSubmit={create} className="px-6 py-5 space-y-4">
          <Field label={t('languages.code')}>
            <input name="code" required className="input" placeholder="ta" />
          </Field>
          <Field label={t('languages.name')}>
            <input name="name" required className="input" placeholder="Tamil" />
          </Field>
          <Field label={t('languages.nativeName')}>
            <input name="nativeName" required className="input" placeholder="தமிழ்" />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title={t('languages.removeConfirm')}
        message={`Remove "${deleteTarget?.name}"?`}
        confirmLabel={t('common.delete')}
        danger
      />
    </div>
  );
}
