import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Globe, Save, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { RootState } from '../../store';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  isEnabled: boolean;
}

// Per-business language preferences. Two independent knobs:
//
//   primaryLanguage  — the customer-facing default when the customer
//                      hasn't picked a language (no ?lang=,
//                      no Accept-Language signal). For a Tamil Nadu
//                      chain this is usually 'ta'; defaults to 'en'.
//
//   eagerLanguages   — the set of languages we pre-translate on every
//                      menu/business edit. Everything else falls to
//                      the lazy on-demand pipeline (D4). The cost
//                      knob: more eager languages = more provider
//                      calls on each menu save.
//
// Customers can still request any platform-enabled language at any
// outlet — this is a *cost* setting, not an availability gate.
export default function BusinessLanguageConfigPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId: string | undefined = user?.businessId;

  const [languages, setLanguages] = useState<Language[]>([]);
  const [primaryLanguage, setPrimary] = useState<string>('en');
  const [eagerLanguages, setEager] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<{ primary: string; eager: string[] }>({ primary: 'en', eager: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        // Use the public /languages endpoint (returns only enabled
        // rows, no platform-admin gate). /languages/all is
        // platform-tier only and 403s for business / outlet
        // accounts.
        const [langsRes, cfgRes] = await Promise.all([
          api.get('/languages'),
          api.get(`/businesses/${businessId}/language-config`),
        ]);
        if (cancelled) return;
        setLanguages(langsRes.data.data || []);
        const cfg = cfgRes.data.data;
        setPrimary(cfg.primaryLanguage || 'en');
        const eager: string[] = cfg.eagerLanguages || [];
        setEager(new Set(eager));
        setOriginal({ primary: cfg.primaryLanguage || 'en', eager });
      } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to load language config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  const toggleEager = (code: string) => {
    setEager((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const dirty =
    primaryLanguage !== original.primary ||
    [...eagerLanguages].sort().join(',') !== [...original.eager].sort().join(',');

  const save = async () => {
    if (!businessId || !dirty) return;
    setSaving(true);
    try {
      const eager = [...eagerLanguages];
      const { data } = await api.put(`/businesses/${businessId}/language-config`, {
        primaryLanguage,
        eagerLanguages: eager,
      });
      const fresh = data.data;
      setOriginal({ primary: fresh.primaryLanguage || 'en', eager: fresh.eagerLanguages || [] });
      toast.success('Language preferences saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!businessId) {
    return (
      <div className="card p-8 text-center">
        <Globe size={36} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500">This page is available for business-tier accounts only.</p>
      </div>
    );
  }

  // /languages already only returns enabled rows. Keep the local
  // names so the JSX downstream stays readable + has a single point
  // to tweak if the eager-vs-primary split ever diverges.
  const enabledLangs = languages;
  const eagerCandidates = languages.filter((l) => l.code !== 'en');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Language preferences</h1>
        <p className="page-subtitle">
          Default render language and the set of languages we pre-translate
          on every menu edit. Customers can still ask for any platform language
          at any outlet — this is a cost knob, not an availability gate.
        </p>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-slate-400">
          <Loader2 size={20} className="inline animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <>
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Default language for customers</h2>
            <p className="text-xs text-slate-500">
              Used when the customer's browser doesn't signal a preference. They can still
              switch from the menu screen.
            </p>
            <select
              className="input max-w-xs"
              value={primaryLanguage}
              onChange={(e) => setPrimary(e.target.value)}
            >
              {enabledLangs.length === 0 ? (
                <option value="en">English (en)</option>
              ) : (
                enabledLangs.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.nativeName}) · {l.code}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Pre-translate to these languages</h2>
            <p className="text-xs text-slate-500">
              Every menu / business edit fires translation jobs for these
              languages. Other enabled languages fall to the on-demand path —
              the first customer who asks pays the latency once, then the
              translation is cached.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {eagerCandidates.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  Enable a non-English language under platform → Languages first.
                </p>
              ) : (
                eagerCandidates.map((l) => {
                  const active = eagerLanguages.has(l.code);
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => toggleEager(l.code)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        active
                          ? 'bg-brand-50 border-brand-200 text-brand-700 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {l.name} ({l.nativeName})
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
