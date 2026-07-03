import { Maximize2, Minimize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

/**
 * Small inline button that flips a useFullscreen() handle. Co-located
 * so every page that exposes fullscreen renders the same icon + tooltip
 * + size; saves five lines and an icon import per page.
 */
export default function FullscreenToggle({
  active,
  onClick,
  className,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className={clsx('btn-ghost p-2 text-slate-500 hover:text-slate-800', className)}
      title={active ? t('common.fullscreenExit') : t('common.fullscreenEnter')}
    >
      {active ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
    </button>
  );
}
