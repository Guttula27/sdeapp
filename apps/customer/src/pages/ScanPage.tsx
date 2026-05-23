import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, QrCode as QrCodeIcon, Store, ChevronRight } from 'lucide-react';
import api from '../services/api';

const SCANNER_ID = 'qr-scanner-region';

function resolveTarget(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

type PublicOutlet = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  primaryImageUrl?: string | null;
  logoUrl?: string | null;
  business?: { name: string } | null;
};

export default function ScanPage() {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<PublicOutlet[]>([]);
  const [outletsLoading, setOutletsLoading] = useState(true);

  useEffect(() => {
    api.get('/outlets/public-list')
      .then(({ data }) => setOutlets(data.data || []))
      .catch(() => setOutlets([]))
      .finally(() => setOutletsLoading(false));
  }, []);

  const stop = async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      await s.clear();
    } catch { /* ignore */ }
    scannerRef.current = null;
    setActive(false);
  };

  const start = async () => {
    setError(null);
    if (scannerRef.current) await stop();
    const instance = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = instance;
    try {
      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          const target = resolveTarget(decoded);
          if (!target) {
            toast.error('QR code not recognised');
            return;
          }
          await stop();
          navigate(target);
        },
        () => { /* scan-frame errors are normal, swallow them */ },
      );
      setActive(true);
    } catch (e: any) {
      setError(e?.message || 'Could not access camera');
      setActive(false);
    }
  };

  useEffect(() => {
    start();
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto bg-slate-900 min-h-dvh flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-orange-400 rounded-xl flex items-center justify-center">
          <QrCodeIcon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-base font-bold text-white">Scan a Menu QR</p>
          <p className="text-xs text-slate-400">Point your camera at the QR on your table</p>
        </div>
      </div>

      {/* Camera view */}
      <div className="relative aspect-square mx-4 rounded-3xl overflow-hidden bg-black border border-white/10">
        <div id={SCANNER_ID} className="w-full h-full" />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-slate-900/85">
            <CameraOff size={32} className="text-slate-400 mb-3" />
            <p className="text-sm font-semibold text-white mb-1">Camera unavailable</p>
            <p className="text-xs text-slate-400 mb-4">{error || 'Tap below to retry.'}</p>
            <button onClick={start}
              className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-bold">
              <Camera size={14} /> Retry
            </button>
          </div>
        )}
        {/* viewfinder overlay */}
        {active && (
          <>
            <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/40" />
            <div className="pointer-events-none absolute top-6 left-6 w-7 h-7 border-t-4 border-l-4 border-brand-400 rounded-tl-xl" />
            <div className="pointer-events-none absolute top-6 right-6 w-7 h-7 border-t-4 border-r-4 border-brand-400 rounded-tr-xl" />
            <div className="pointer-events-none absolute bottom-6 left-6 w-7 h-7 border-b-4 border-l-4 border-brand-400 rounded-bl-xl" />
            <div className="pointer-events-none absolute bottom-6 right-6 w-7 h-7 border-b-4 border-r-4 border-brand-400 rounded-br-xl" />
          </>
        )}
      </div>

      {/* Outlet picker (test-mode shortcut, until QR scanning is wired up) */}
      <div className="px-4 pt-5 pb-6 flex-1 overflow-y-auto">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Or pick an outlet</p>
        {outletsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : outlets.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-8">No outlets available.</p>
        ) : (
          <div className="space-y-2">
            {outlets.map((o) => (
              <button
                key={o.id}
                onClick={() => navigate(`/order?outlet=${o.id}`)}
                className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl px-3 py-2.5 text-left transition-colors"
              >
                {o.logoUrl || o.primaryImageUrl ? (
                  <img
                    src={o.logoUrl || o.primaryImageUrl || ''}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0 bg-white/5"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-orange-400 flex items-center justify-center shrink-0">
                    <Store size={16} className="text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{o.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {o.business?.name && <span>{o.business.name}</span>}
                    {o.business?.name && (o.city || o.address) && <span> · </span>}
                    {o.city || o.address || ''}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-500 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
