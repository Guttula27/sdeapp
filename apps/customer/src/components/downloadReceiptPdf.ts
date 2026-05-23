import html2pdf from 'html2pdf.js';

/**
 * Render the given DOM node into a thermal-printer-sized PDF (80mm wide)
 * and trigger a download. The node should be a fully-styled ThermalReceipt;
 * we pass it as-is and html2pdf rasterises it via html2canvas + jsPDF.
 */
export function downloadReceiptPdf(node: HTMLElement, fileName: string) {
  return html2pdf()
    .from(node)
    .set({
      filename: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      margin: 0,
      // 80mm width matches thermal printers; pick a long page so we never split
      // a 1-page receipt across two PDF pages. html2canvas dpi at 2 keeps text crisp.
      jsPDF: { unit: 'mm', format: [80, 297], orientation: 'portrait' },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    } as any)
    .save();
}
