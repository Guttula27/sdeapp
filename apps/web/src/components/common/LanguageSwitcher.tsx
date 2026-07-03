import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { SUPPORTED_LANGS } from '../../i18n';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const current =
    SUPPORTED_LANGS.find((l) => l.code === i18n.language) ||
    SUPPORTED_LANGS.find((l) => l.code === i18n.language.split('-')[0]) ||
    SUPPORTED_LANGS[0];

  const pick = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('layout.languageLabel')}
        aria-label={t('layout.languageLabel')}
        className={clsx(
          'flex items-center gap-1.5 pl-2 pr-2 py-1.5 rounded-xl border-[1.5px] transition-all duration-150',
          open
            ? 'bg-brand-50 border-brand-300 shadow-[0_0_0_3px_rgb(249_115_22_/_0.12)]'
            : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-slate-300',
        )}
      >
        <Globe size={14} className="text-slate-500 shrink-0" />
        <span className="hidden sm:inline text-[12px] font-semibold text-slate-700">
          {current.nativeName}
        </span>
        <ChevronDown
          size={12}
          className={clsx('text-slate-400 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-pop border border-slate-100 overflow-hidden z-50 animate-slide-down">
          <div className="max-h-80 overflow-auto py-1">
            {SUPPORTED_LANGS.map((l) => {
              const active = l.code === current.code;
              return (
                <button
                  key={l.code}
                  onClick={() => pick(l.code)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-slate-50 transition-colors',
                    active ? 'text-slate-900 font-semibold' : 'text-slate-600',
                  )}
                >
                  <span className="flex-1 text-left">
                    <span className="block leading-tight">{l.nativeName}</span>
                    <span className="block text-[11px] text-slate-400 leading-tight">
                      {l.englishName}
                    </span>
                  </span>
                  {active && <Check size={14} className="text-brand-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
