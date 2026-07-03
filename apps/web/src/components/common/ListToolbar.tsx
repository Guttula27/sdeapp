import { Search, ArrowUp, ArrowDown, X as XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Search input + sort dropdown + asc/desc toggle, drop-in for the top
 * of any list view. Filtering / sorting is the caller's concern — this
 * is purely controlled state.
 *
 * Pass `sortOptions` as an array of [value, label] pairs. The
 * `searchPlaceholder` tells the operator which fields the needle will
 * match against; keep it short and specific (e.g. "Name, phone, GST").
 */
export default function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  sortBy,
  onSortByChange,
  sortDir,
  onSortDirChange,
  sortOptions,
  extras,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  sortBy: string;
  onSortByChange: (v: string) => void;
  sortDir: 'asc' | 'desc';
  onSortDirChange: (v: 'asc' | 'desc') => void;
  sortOptions: Array<{ value: string; label: string }>;
  // Optional extra controls (e.g. an Outlet picker on Orders).
  extras?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="card p-3 flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[220px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder ?? t('common.searchPlaceholder')}
          className="input pl-8 text-sm"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            title={t('common.clearSearch')}
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
      {extras}
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('common.sort')}</label>
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          className="input text-xs h-8"
          style={{ minWidth: 120 }}
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => onSortDirChange(sortDir === 'asc' ? 'desc' : 'asc')}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          title={sortDir === 'asc' ? t('common.sortDescTitle') : t('common.sortAscTitle')}
        >
          {sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </button>
      </div>
    </div>
  );
}
