// Compose a printable QR card on a canvas and trigger a PNG download.
// The card always shows the outlet's name + address for in-store context,
// plus a target label and the QR encoding the destination URL.

export interface QrCardOptions {
  outletName?: string;
  outletAddress?: string;
  label?: string;            // e.g. "TABLE", "BEVERAGES", "CAPPUCCINO"
  detail?: string;           // e.g. table number, category name, item name
  caption?: string;          // e.g. "Scan to view menu", "Scan for this item"
  url: string;               // destination URL to encode in the QR
  filename: string;          // download filename
}

export async function downloadQrCard(opts: QrCardOptions): Promise<void> {
  const W = 720, H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Card background + border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // Top gradient strip (brand)
  const grad = ctx.createLinearGradient(0, 0, W, 80);
  grad.addColorStop(0, '#f97316');
  grad.addColorStop(1, '#ea580c');
  ctx.fillStyle = grad;
  ctx.fillRect(8, 8, W - 16, 12);

  // Outlet name
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px ui-sans-serif, system-ui';
  ctx.fillText(opts.outletName || 'Outlet', W / 2, 80);

  // Address — wrap to up to 2 lines
  if (opts.outletAddress) {
    ctx.fillStyle = '#64748b';
    ctx.font = '18px ui-sans-serif, system-ui';
    const maxWidth = W - 80;
    const words = opts.outletAddress.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const probe = line ? `${line} ${w}` : w;
      if (ctx.measureText(probe).width > maxWidth) {
        if (line) lines.push(line);
        line = w;
        if (lines.length >= 2) break;
      } else {
        line = probe;
      }
    }
    if (line && lines.length < 2) lines.push(line);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, 120 + i * 24));
  }

  // Divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 190); ctx.lineTo(W - 80, 190); ctx.stroke();

  // Target caption (e.g. "SCAN TO VIEW MENU")
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 20px ui-sans-serif, system-ui';
  ctx.fillText((opts.caption || 'SCAN TO VIEW MENU').toUpperCase(), W / 2, 230);

  // Fetch the QR PNG from a free generator (no extra dep)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=2&data=${encodeURIComponent(opts.url)}`;
  const qr = await loadImage(qrUrl);

  const QR_SIZE = 480;
  const qx = (W - QR_SIZE) / 2;
  const qy = 260;
  ctx.drawImage(qr, qx, qy, QR_SIZE, QR_SIZE);

  // Target label + detail (e.g. TABLE / 5, BEVERAGES, CAPPUCCINO)
  if (opts.label) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px ui-sans-serif, system-ui';
    ctx.fillText(opts.label.toUpperCase(), W / 2, qy + QR_SIZE + 50);
  }
  if (opts.detail) {
    ctx.fillStyle = '#ea580c';
    ctx.font = 'bold 48px ui-sans-serif, system-ui';
    ctx.fillText(opts.detail, W / 2, qy + QR_SIZE + 105);
  }

  // Footer
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px ui-sans-serif, system-ui';
  ctx.fillText('Open camera and scan', W / 2, H - 30);

  // Trigger download
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = opts.filename.replace(/\s+/g, '-').toLowerCase();
  a.click();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
