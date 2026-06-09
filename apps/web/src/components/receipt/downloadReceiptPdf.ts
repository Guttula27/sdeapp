import html2pdf from 'html2pdf.js';

/**
 * Render the given DOM node into a thermal-printer-sized PDF and trigger
 * a download. The node should be a fully-styled ThermalReceipt; we pass
 * it as-is and html2pdf rasterises it via html2canvas + jsPDF.
 *
 * `paperWidthMm` defaults to 80 (the common roll size). Pass 58 or 76
 * to match smaller rolls; the PDF page width follows so the printed
 * output fills the roll edge-to-edge without scaling artefacts.
 */
export function downloadReceiptPdf(
  node: HTMLElement,
  fileName: string,
  paperWidthMm: number = 80,
) {
  return html2pdf()
    .from(node)
    .set({
      filename: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      margin: 0,
      // Width matches the receipt's rendered paper width; the long
      // page (297mm = A4) gives plenty of room for the longest
      // single-bill receipts without splitting across two pages.
      jsPDF: { unit: 'mm', format: [paperWidthMm, 297], orientation: 'portrait' },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    } as any)
    .save();
}
