import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Languages as LangIcon, Save, Search, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { RootState } from '../../store';

// One row in the editable table — mirrors the backend response shape
// from GET /outlets/:outletId/i18n/strings.
interface StringRow {
  entityType: string;
  entityId: string;
  fieldName: string;
  sourceText: string;
  translatedText: string;
  source: 'auto' | 'manual' | 'missing';
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
  isEnabled: boolean;
}

const ENTITY_LABELS: Record<string, string> = {
  Outlet: 'Outlet info',
  Category: 'Categories',
  Subcategory: 'Subcategories',
  Item: 'Menu items',
  Variant: 'Variants',
  Topping: 'Toppings',
  ToppingOption: 'Topping options',
  CustomerTag: 'Customer tags',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  shortDescription: 'Short description',
  address: 'Address',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
};

const SOURCE_BADGE: Record<StringRow['source'], { label: string; className: string }> = {
  manual:  { label: 'Manual',  className: 'bg-amber-100 text-amber-800' },
  auto:    { label: 'Auto',    className: 'bg-slate-100 text-slate-600' },
  missing: { label: 'Missing', className: 'bg-rose-100 text-rose-700' },
};

const PAGE_SIZE = 50;

export default function TranslationsPage() {
  // The outlet admin's outletId comes off the JWT-derived user record.
  // Outside an outlet context (e.g. business owner viewing this page)
  // we render an empty-state — this page is outlet-scoped.
  const user = useSelector((s: RootState) => s.auth.user);
  const outletId: string | undefined = user?.outletId;

  const [languages, setLanguages] = useState<Language[]>([]);
  const [lang, setLang] = useState<string>('');
  const [entityType, setEntityType] = useState<string>('Item');
  const [search, setSearch] = useState<string>('');
  const [searchDebounced, setSearchDebounced] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const [rows, setRows] = useState<StringRow[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Pull the platform-supported languages list so the admin picks
  // a target language from a dropdown. Use the public GET /languages
  // endpoint (only returns enabled rows, no platform-admin gate) —
  // outlet admins can't reach /languages/all (it's platform-only).
  // There's no point editing English (it IS the source), so we also
  // filter that out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/languages');
        if (cancelled) return;
        const all: Language[] = data.data || [];
        const targets = all.filter((l) => l.code !== 'en');
        setLanguages(targets);
        if (targets.length && !lang) setLang(targets[0].code);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Could not load languages');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce the search box — 300 ms is the usual sweet spot for a
  // typeahead that hits the server. Resets the page back to 1 so the
  // user doesn't end up on page 7 of a fresh result set.
  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(async () => {
    if (!outletId || !lang || !entityType) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/i18n/strings`, {
        params: { lang, entityType, search: searchDebounced || undefined, page, limit: PAGE_SIZE },
      });
      setRows(data.data.rows || []);
      setTotal(data.data.total || 0);
      setEntityTypes(data.data.entityTypes || []);
      setDrafts({}); // Reset edits when the page changes — avoids stale "save" buttons.
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load translations');
    } finally {
      setLoading(false);
    }
  }, [outletId, lang, entityType, searchDebounced, page]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const draftKey = (r: StringRow) => `${r.entityId}:${r.fieldName}`;

  const save = async (r: StringRow) => {
    const key = draftKey(r);
    const value = (drafts[key] ?? '').trim();
    if (!value) {
      toast.error('Translation cannot be empty');
      return;
    }
    setSavingKey(key);
    try {
      await api.put(`/outlets/${outletId}/i18n/strings`, {
        entityType: r.entityType,
        entityId: r.entityId,
        fieldName: r.fieldName,
        languageCode: lang,
        value,
      });
      setRows((prev) =>
        prev.map((row) =>
          draftKey(row) === key
            ? { ...row, translatedText: value, source: 'manual' }
            : row,
        ),
      );
      setDrafts((d) => { const copy = { ...d }; delete copy[key]; return copy; });
      toast.success('Saved — customer menu refreshes on next load');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save');
    } finally {
      setSavingKey(null);
    }
  };

  const summary = useMemo(() => {
    const counts = rows.reduce(
      (acc, r) => {
        acc[r.source] = (acc[r.source] || 0) + 1;
        return acc;
      },
      {} as Record<StringRow['source'], number>,
    );
    return counts;
  }, [rows]);

  if (!outletId) {
    return (
      <div className="card p-8 text-center">
        <LangIcon size={36} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500">This page is available for outlet-tier accounts only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Translations</h1>
          <p className="page-subtitle">
            Review and correct auto-generated translations for your outlet.
            Edits are flagged as manual and will not be overwritten by future
            auto-translation passes.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Language</label>
          <select
            className="input"
            value={lang}
            onChange={(e) => { setLang(e.target.value); setPage(1); }}
            disabled={!languages.length}
          >
            {languages.length === 0 ? (
              <option value="">No target languages enabled</option>
            ) : (
              languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.nativeName})
                </option>
              ))
            )}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Section</label>
          <select
            className="input"
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          >
            {(entityTypes.length ? entityTypes : ['Item']).map((et) => (
              <option key={et} value={et}>{ENTITY_LABELS[et] ?? et}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-8"
              placeholder="Filter by English text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="text-xs text-slate-500 self-center ml-auto">
          {rows.length > 0 && (
            <>
              <span className="inline-block px-2 py-1 mr-1 rounded bg-amber-100 text-amber-800">Manual: {summary.manual || 0}</span>
              <span className="inline-block px-2 py-1 mr-1 rounded bg-slate-100 text-slate-700">Auto: {summary.auto || 0}</span>
              <span className="inline-block px-2 py-1 rounded bg-rose-100 text-rose-700">Missing: {summary.missing || 0}</span>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 size={20} className="inline animate-spin mr-2" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <LangIcon size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500">
              {languages.length === 0
                ? 'Enable a target language under platform → Languages first.'
                : 'No translatable strings in this section.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3 w-[18%]">Field</th>
                <th className="px-5 py-3 w-[33%]">English (source)</th>
                <th className="px-5 py-3 w-[33%]">Translation</th>
                <th className="px-5 py-3 w-[8%]">Status</th>
                <th className="px-5 py-3 w-[8%] text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const key = draftKey(r);
                const draft = drafts[key];
                const current = draft ?? r.translatedText;
                const isDirty = draft !== undefined && draft !== r.translatedText;
                const badge = SOURCE_BADGE[r.source];
                return (
                  <tr key={key} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 text-slate-600 text-xs font-mono">
                      {FIELD_LABELS[r.fieldName] ?? r.fieldName}
                    </td>
                    <td className="px-5 py-3 text-slate-900 align-top">
                      <div className="line-clamp-2 leading-snug">{r.sourceText}</div>
                    </td>
                    <td className="px-5 py-3">
                      <textarea
                        className="input min-h-[36px] py-1.5 resize-y w-full"
                        rows={1}
                        value={current}
                        placeholder={r.source === 'missing' ? 'Add translation…' : ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="btn-primary !py-1.5 !px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!isDirty || savingKey === key}
                        onClick={() => save(r)}
                      >
                        {savingKey === key ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <Save size={14} /> Save
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page} of {totalPages} · {total} entities
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary !py-1.5 !px-3 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              className="btn-secondary !py-1.5 !px-3 disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
