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
