// Tiny Web-Bluetooth ESC/POS printer helper. Used by the kitchen page to
// auto-print or manually print kitchen tickets to a paired bluetooth
// thermal printer.
//
// Pairing requires a user gesture (Bluetooth API contract), so the page
// exposes a "Connect printer" button. Once paired, the device handle is
// cached in this module for subsequent silent prints — at least until the
// browser disconnects (tab close / sleep). On disconnect the user re-pairs.
//
// We don't lock down the service UUID: many cheap thermal printers expose
// the standard ESC/POS service 000018f0, but some clones publish a custom
// one. We scan the device's primary services for any characteristic with
// `write` or `writeWithoutResponse` and use the first one we find.

const SCAN_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';

type Handle = {
  device: any;
  characteristic: any;
};

const handles = new Map<string, Handle>();

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
}

export function isPrinterConnected(printerId: string): boolean {
  const h = handles.get(printerId);
  return !!(h && h.device?.gatt?.connected);
}

// User-gesture call. Opens the browser's BT chooser, lets the operator
// pick the printer this station should use, then resolves once we have a
// writable characteristic.
export async function connectPrinter(printerId: string): Promise<void> {
  if (!isBluetoothSupported()) throw new Error('Web Bluetooth not supported');
  const nav: any = navigator;
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SCAN_SERVICE],
  });
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  let chosen: any = null;
  outer: for (const svc of services) {
    const chars = await svc.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        chosen = ch;
        break outer;
      }
    }
  }
  if (!chosen) throw new Error('No writable characteristic found on device');
  handles.set(printerId, { device, characteristic: chosen });
  device.addEventListener('gattserverdisconnected', () => handles.delete(printerId));
}

async function writeBytes(printerId: string, bytes: Uint8Array): Promise<void> {
  const h = handles.get(printerId);
  if (!h) throw new Error('Printer not connected — tap "Connect printer" first');
  // BLE MTU caps writes to ~20 bytes on many devices; chunk to be safe.
  const chunk = 64;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.slice(i, i + chunk);
    if (h.characteristic.properties.writeWithoutResponse) {
      await h.characteristic.writeValueWithoutResponse(slice);
    } else {
      await h.characteristic.writeValue(slice);
    }
  }
}

// ESC/POS receipt builder. Plain-ASCII text only — works on the cheapest
// thermal printers without code-page handshakes. Anything outside ASCII is
// approximated to '?' so the print head doesn't choke.
function asAscii(s: string): string {
  return s.replace(/[^\x20-\x7E\n]/g, '?');
}

export type ReceiptLine = {
  itemName: string;
  variantName: string | null;
  toppings: string | null;
  quantity: number;
  notes: string | null;
};

export type ReceiptPayload = {
  orderNumber: string;
  tokenNumber: number | null;
  outletName: string;
  table: string | null;
  section: string | null;
  isParcel: boolean;
  stationName: string;
  printedAt: string;
  lines: ReceiptLine[];
};

function buildEscPos(r: ReceiptPayload): Uint8Array {
  const enc = new TextEncoder();
  const ESC = 0x1b;
  const GS = 0x1d;
  const buf: number[] = [];
  const push = (s: string) => { for (const c of enc.encode(asAscii(s))) buf.push(c); };
  const cmd = (...b: number[]) => { for (const c of b) buf.push(c); };

  cmd(ESC, 0x40);          // init
  cmd(ESC, 0x61, 0x01);    // center
  cmd(ESC, 0x21, 0x30);    // double w/h
  push(r.stationName.toUpperCase() + '\n');
  cmd(ESC, 0x21, 0x00);    // normal
  push(r.outletName + '\n');
  push('--------------------------------\n');
  cmd(ESC, 0x21, 0x30);
  if (r.tokenNumber != null) push(`TOKEN #${r.tokenNumber}\n`);
  cmd(ESC, 0x21, 0x00);
  cmd(ESC, 0x61, 0x00);    // left
  push(`Order: ${r.orderNumber}\n`);
  if (r.table) push(`Table: ${r.table}${r.section ? ` (${r.section})` : ''}\n`);
  else if (r.isParcel) push('PARCEL\n');
  else if (r.section) push(`Service desk: ${r.section}\n`);
  push(`Time: ${new Date(r.printedAt).toLocaleTimeString()}\n`);
  push('--------------------------------\n');
  for (const li of r.lines) {
    cmd(ESC, 0x21, 0x10);  // double height
    push(`${li.quantity} x ${li.itemName}\n`);
    cmd(ESC, 0x21, 0x00);
    if (li.variantName) push(`   ${li.variantName}\n`);
    if (li.toppings) push(`   + ${li.toppings}\n`);
    if (li.notes) push(`   * ${li.notes}\n`);
  }
  push('--------------------------------\n');
  cmd(ESC, 0x64, 0x04);    // feed 4 lines
  cmd(GS, 0x56, 0x00);     // full cut

  return new Uint8Array(buf);
}

export async function printReceipt(printerId: string, receipt: ReceiptPayload): Promise<void> {
  const bytes = buildEscPos(receipt);
  await writeBytes(printerId, bytes);
}

// ── Customer bill ──────────────────────────────────────────────────────
// Distinct from the kitchen-station ticket — this is the full customer
// receipt with prices, discounts, GST split (CGST+SGST or IGST), and
// grand total. Same ESC/POS sequence, 32-char width tuned for a 58mm
// roll (most common thermal printer); 80mm rolls render with right-
// justified amounts that still line up by virtue of the rune-padding
// below.
export type ReceiptItemLine = {
  itemName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type ReceiptDiscountLine = {
  label: string;
  amount: number;
};

export type CustomerReceiptPayload = {
  orderNumber: string;
  tokenNumber: number | null;
  printedAt: string;
  outletName: string;
  outletAddress?: string[];      // each line rendered separately
  outletGstin?: string | null;
  outletPhone?: string | null;
  customerName?: string | null;
  table?: string | null;
  isParcel?: boolean;

  items: ReceiptItemLine[];
  subtotal: number;
  parcelCharge?: number;
  discounts: ReceiptDiscountLine[];      // each rendered as -₹X
  taxable: number;                       // subtotal - discount
  // Either cgst+sgst pair (intra-state) or igst alone (inter-state).
  cgst?: number;
  sgst?: number;
  igst?: number;
  gstPct?: number;                       // total %, used for "CGST 2.5%" label
  roundOff?: number;
  total: number;
  paidVia?: string | null;
};

const W = 32; // 58mm thermal char width — works on 80mm too with safe margins
function pad(left: string, right: string, width = W): string {
  const l = asAscii(left);
  const r = asAscii(right);
  const free = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(free) + r;
}
function dash(width = W) { return '-'.repeat(width); }
function fmt(n: number): string { return n.toFixed(2); }

function buildCustomerEscPos(r: CustomerReceiptPayload): Uint8Array {
  const enc = new TextEncoder();
  const ESC = 0x1b;
  const GS = 0x1d;
  const buf: number[] = [];
  const push = (s: string) => { for (const c of enc.encode(asAscii(s))) buf.push(c); };
  const cmd = (...b: number[]) => { for (const c of b) buf.push(c); };

  cmd(ESC, 0x40);          // init
  cmd(ESC, 0x61, 0x01);    // center
  cmd(ESC, 0x21, 0x30);    // double w/h
  push(r.outletName.toUpperCase() + '\n');
  cmd(ESC, 0x21, 0x00);    // normal
  for (const line of r.outletAddress ?? []) push(line + '\n');
  if (r.outletPhone) push('Tel: ' + r.outletPhone + '\n');
  if (r.outletGstin)  push('GSTIN: ' + r.outletGstin + '\n');

  cmd(ESC, 0x61, 0x00);    // left
  push('\n' + dash() + '\n');
  if (r.customerName) push('Name : ' + r.customerName + '\n');
  push('Bill : ' + r.orderNumber + '\n');
  if (r.tokenNumber != null) push('Token: #' + r.tokenNumber + '\n');
  if (r.table) push('Table: ' + r.table + '\n');
  else if (r.isParcel) push('Type : PARCEL\n');
  push('Date : ' + new Date(r.printedAt).toLocaleString('en-IN') + '\n');
  push(dash() + '\n');

  push(pad('Item', 'Amt') + '\n');
  push(dash() + '\n');
  for (const it of r.items) {
    push(`${it.quantity} x ${it.itemName}\n`);
    if (it.variantName) push(`   ${it.variantName}\n`);
    push(pad(`   @ ${fmt(it.unitPrice)}`, fmt(it.totalPrice)) + '\n');
  }
  push(dash() + '\n');

  push(pad('Sub Total', fmt(r.subtotal)) + '\n');
  if (r.parcelCharge && r.parcelCharge > 0) {
    push(pad('Parcel', fmt(r.parcelCharge)) + '\n');
  }
  for (const d of r.discounts) {
    push(pad(d.label, '-' + fmt(d.amount)) + '\n');
  }
  if (r.discounts.length > 0) {
    push(pad('Taxable', fmt(r.taxable)) + '\n');
  }
  if (r.cgst != null && r.sgst != null && (r.cgst > 0 || r.sgst > 0)) {
    const half = ((r.gstPct ?? 0) / 2).toFixed(1).replace(/\.0$/, '');
    push(pad(`CGST ${half}%`, fmt(r.cgst)) + '\n');
    push(pad(`SGST ${half}%`, fmt(r.sgst)) + '\n');
  } else if (r.igst && r.igst > 0) {
    const full = (r.gstPct ?? 0).toFixed(1).replace(/\.0$/, '');
    push(pad(`IGST ${full}%`, fmt(r.igst)) + '\n');
  }
  if (r.roundOff && r.roundOff !== 0) {
    push(pad('Round off', (r.roundOff > 0 ? '+' : '-') + fmt(Math.abs(r.roundOff))) + '\n');
  }

  push(dash() + '\n');
  cmd(ESC, 0x21, 0x10);    // double height
  push(pad('TOTAL', '₹' + fmt(r.total)) + '\n');
  cmd(ESC, 0x21, 0x00);
  if (r.paidVia) push('Paid: ' + r.paidVia + '\n');

  push(dash() + '\n');
  cmd(ESC, 0x61, 0x01);    // center
  push('Thank you, visit again!\n');

  cmd(ESC, 0x64, 0x04);    // feed 4 lines
  cmd(GS, 0x56, 0x00);     // full cut
  return new Uint8Array(buf);
}

export async function printCustomerReceipt(
  printerId: string,
  receipt: CustomerReceiptPayload,
): Promise<void> {
  const bytes = buildCustomerEscPos(receipt);
  await writeBytes(printerId, bytes);
}
