import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import type { GovernmentHolidayMaster, MonthlyDiaryDocument, VillageMaster } from '../shared/types.ts';
import { formatDateDDMMYYYY, resolveHolidayEntryDisplay } from '../shared/marathi.ts';
import { parseDetailedWorkNotes, resolveDiaryEntryTravel } from '../shared/travelMeta.ts';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_PX = 794; // 210mm at 96 DPI
const A4_HEIGHT_PX = 1123; // 297mm at 96 DPI
const CAPTURE_VERTICAL_PADDING_PX = 64; // 32px top + 32px bottom (.print-pdf-capture)
const PAGE_FOOTER_RESERVE_PX = 28;

async function renderSheetNodeToPng(
  node: HTMLElement,
  width: number,
  height: number
): Promise<string> {
  return await toPng(node, {
    pixelRatio: 2.5,
    backgroundColor: '#ffffff',
    width,
    height,
    cacheBust: false,
    skipFonts: true,
    fontEmbedCSS: '',
  });
}

/**
 * Exports the generated Monthly Tour Diary (or a single date / date range) directly to an A4 printable PDF (.pdf)
 * using the exact `.print-only` / `.print-sheet` / `.diary-print-table` CSS layout.
 * Automatically paginates at table row boundaries if content exceeds one A4 page.
 */
export async function exportMonthlyDiaryToPdf(
  printElement: HTMLElement,
  doc: MonthlyDiaryDocument,
  customFileSuffix?: string
): Promise<void> {
  const fileName = customFileSuffix
    ? `दौरा_दैनंदिनी_${customFileSuffix}.pdf`
    : `मासिक_दौरा_दैनंदिनी_${doc.sheetName}.pdf`;

  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed even if font readiness check fails
    }
  }

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.width = `${A4_WIDTH_PX}px`;
  host.style.backgroundColor = '#ffffff';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  try {
    const measureClone = printElement.cloneNode(true) as HTMLElement;
    measureClone.classList.add('print-pdf-capture');
    host.appendChild(measureClone);

    // Wait a frame so browser computes exact Marathi Devanagari line-wrapping heights
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const fullHeight = Math.ceil(measureClone.scrollHeight);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    if (fullHeight <= A4_HEIGHT_PX) {
      const pngDataUrl = await renderSheetNodeToPng(measureClone, A4_WIDTH_PX, fullHeight);
      const renderedHeightMm = (fullHeight * A4_WIDTH_MM) / A4_WIDTH_PX;
      pdf.addImage(pngDataUrl, 'PNG', 0, 0, A4_WIDTH_MM, Math.min(renderedHeightMm, A4_HEIGHT_MM), undefined, 'FAST');
      pdf.save(fileName);
      return;
    }

    // Multi-page A4 pagination split cleanly at table row boundaries (never slicing a row mid-line)
    const headerEl = measureClone.querySelector<HTMLElement>('.diary-print-header');
    const tableEl = measureClone.querySelector<HTMLTableElement>('table.diary-print-table');
    const theadEl = tableEl?.querySelector<HTMLElement>('thead');
    const tbodyRows = Array.from(tableEl?.querySelectorAll<HTMLTableRowElement>('tbody tr') ?? []);
    const summaryEl = measureClone.querySelector<HTMLElement>('.diary-print-summary');
    const signaturesEl = measureClone.querySelector<HTMLElement>('.diary-print-signatures');

    if (!tableEl || !theadEl || tbodyRows.length === 0) {
      // Fallback: scale cleanly onto single A4 page
      const pngDataUrl = await renderSheetNodeToPng(measureClone, A4_WIDTH_PX, fullHeight);
      const scale = Math.min(A4_WIDTH_MM / A4_WIDTH_PX, A4_HEIGHT_MM / fullHeight);
      const imgW = A4_WIDTH_PX * scale;
      const imgH = fullHeight * scale;
      pdf.addImage(pngDataUrl, 'PNG', (A4_WIDTH_MM - imgW) / 2, 0, imgW, imgH, undefined, 'FAST');
      pdf.save(fileName);
      return;
    }

    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height + 10 : 0;
    const theadHeight = theadEl.getBoundingClientRect().height + 2;
    const rowHeights = tbodyRows.map((tr) => Math.ceil(tr.getBoundingClientRect().height));
    const summaryHeight = summaryEl ? Math.ceil(summaryEl.getBoundingClientRect().height) + 12 : 0;
    const signaturesHeight = signaturesEl ? Math.ceil(signaturesEl.getBoundingClientRect().height) + 32 : 0;
    const tailHeight = summaryHeight + signaturesHeight;
    const maxUsableHeight = A4_HEIGHT_PX - CAPTURE_VERTICAL_PADDING_PX - PAGE_FOOTER_RESERVE_PX;

    interface PageSpec {
      rowIndices: number[];
      includeHeader: boolean;
      includeTail: boolean;
    }

    const pages: PageSpec[] = [];
    let currentRows: number[] = [];
    let isFirstPage = true;
    let usedHeight = headerHeight + theadHeight;

    for (let i = 0; i < rowHeights.length; i++) {
      const rh = rowHeights[i];
      if (currentRows.length > 0 && usedHeight + rh > maxUsableHeight) {
        pages.push({ rowIndices: currentRows, includeHeader: isFirstPage, includeTail: false });
        isFirstPage = false;
        currentRows = [i];
        usedHeight = theadHeight + rh;
      } else {
        currentRows.push(i);
        usedHeight += rh;
      }
    }

    if (currentRows.length > 0) {
      if (usedHeight + tailHeight <= maxUsableHeight) {
        pages.push({ rowIndices: currentRows, includeHeader: isFirstPage, includeTail: true });
      } else {
        pages.push({ rowIndices: currentRows, includeHeader: isFirstPage, includeTail: false });
        pages.push({ rowIndices: [], includeHeader: false, includeTail: true });
      }
    }

    const totalPages = pages.length;

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const spec = pages[pageIdx];
      const pageSheet = document.createElement('div');
      pageSheet.className = 'print-only print-sheet print-pdf-capture';

      if (spec.includeHeader && headerEl) {
        pageSheet.appendChild(headerEl.cloneNode(true));
      }

      if (spec.rowIndices.length > 0) {
        const pageTable = document.createElement('table');
        pageTable.className = 'diary-print-table';
        pageTable.appendChild(theadEl.cloneNode(true));
        const pageTbody = document.createElement('tbody');
        for (const rIdx of spec.rowIndices) {
          pageTbody.appendChild(tbodyRows[rIdx].cloneNode(true));
        }
        pageTable.appendChild(pageTbody);
        pageSheet.appendChild(pageTable);
      }

      if (spec.includeTail) {
        if (summaryEl) pageSheet.appendChild(summaryEl.cloneNode(true));
        if (signaturesEl) pageSheet.appendChild(signaturesEl.cloneNode(true));
      }

      if (totalPages > 1) {
        const footer = document.createElement('div');
        footer.className = 'diary-print-page-footer';
        footer.textContent = `${doc.monthLabelMarathi} — पान ${pageIdx + 1} / ${totalPages}`;
        pageSheet.appendChild(footer);
      }

      host.innerHTML = '';
      host.appendChild(pageSheet);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const pageHeight = Math.min(Math.ceil(pageSheet.scrollHeight), A4_HEIGHT_PX);
      const pngDataUrl = await renderSheetNodeToPng(pageSheet, A4_WIDTH_PX, pageHeight);
      const renderedHeightMm = (pageHeight * A4_WIDTH_MM) / A4_WIDTH_PX;

      if (pageIdx > 0) {
        pdf.addPage('a4', 'portrait');
      }
      pdf.addImage(
        pngDataUrl,
        'PNG',
        0,
        0,
        A4_WIDTH_MM,
        Math.min(renderedHeightMm, A4_HEIGHT_MM),
        undefined,
        'FAST'
      );
    }

    pdf.save(fileName);
  } finally {
    host.remove();
  }
}

/**
 * Generic A4 PDF exporter for any `.print-only.print-sheet` document (such as Daily Detailed Work Reports).
 */
export async function exportElementToA4Pdf(
  printElement: HTMLElement,
  fileNameWithoutExt: string,
  pageFooterPrefix = 'सविस्तर कामाचा वृत्तांत'
): Promise<void> {
  const fileName = fileNameWithoutExt.endsWith('.pdf')
    ? fileNameWithoutExt
    : `${fileNameWithoutExt}.pdf`;

  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed even if font readiness check fails
    }
  }

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.width = `${A4_WIDTH_PX}px`;
  host.style.backgroundColor = '#ffffff';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  try {
    const measureClone = printElement.cloneNode(true) as HTMLElement;
    measureClone.classList.add('print-pdf-capture');
    host.appendChild(measureClone);

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const fullHeight = Math.ceil(measureClone.scrollHeight);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    if (fullHeight <= A4_HEIGHT_PX) {
      const pngDataUrl = await renderSheetNodeToPng(measureClone, A4_WIDTH_PX, fullHeight);
      const renderedHeightMm = (fullHeight * A4_WIDTH_MM) / A4_WIDTH_PX;
      pdf.addImage(pngDataUrl, 'PNG', 0, 0, A4_WIDTH_MM, Math.min(renderedHeightMm, A4_HEIGHT_MM), undefined, 'FAST');
      pdf.save(fileName);
      return;
    }

    const headerEl = measureClone.querySelector<HTMLElement>('.diary-print-header');
    const metaBarEl = measureClone.querySelector<HTMLElement>('.book-report-meta-bar');
    const tableEl = measureClone.querySelector<HTMLTableElement>('table.diary-print-table');
    const theadEl = tableEl?.querySelector<HTMLElement>('thead');
    const tbodyRows = Array.from(tableEl?.querySelectorAll<HTMLTableRowElement>('tbody tr') ?? []);
    const bookBlocks = Array.from(measureClone.querySelectorAll<HTMLElement>('[data-pdf-block]'));
    const summaryEl = measureClone.querySelector<HTMLElement>('.diary-print-summary');
    const signaturesEl = measureClone.querySelector<HTMLElement>('.diary-print-signatures');

    // Book-print paragraph pagination (for non-table narrative reports)
    if ((!tableEl || !theadEl || tbodyRows.length === 0) && bookBlocks.length > 0) {
      const headerHeight =
        (headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) + 10 : 0) +
        (metaBarEl ? Math.ceil(metaBarEl.getBoundingClientRect().height) + 16 : 0);
      const blockHeights = bookBlocks.map((el) => Math.ceil(el.getBoundingClientRect().height) + 10);
      const summaryHeight = summaryEl ? Math.ceil(summaryEl.getBoundingClientRect().height) + 12 : 0;
      const signaturesHeight = signaturesEl ? Math.ceil(signaturesEl.getBoundingClientRect().height) + 32 : 0;
      const tailHeight = summaryHeight + signaturesHeight;
      const maxUsableHeight = A4_HEIGHT_PX - CAPTURE_VERTICAL_PADDING_PX - PAGE_FOOTER_RESERVE_PX;

      interface BookPageSpec {
        blockIndices: number[];
        includeHeader: boolean;
        includeTail: boolean;
      }

      const bookPages: BookPageSpec[] = [];
      let currentBlocks: number[] = [];
      let isFirstPage = true;
      let usedHeight = headerHeight;

      for (let i = 0; i < blockHeights.length; i++) {
        const bh = blockHeights[i];
        if (currentBlocks.length > 0 && usedHeight + bh > maxUsableHeight) {
          bookPages.push({ blockIndices: currentBlocks, includeHeader: isFirstPage, includeTail: false });
          isFirstPage = false;
          currentBlocks = [i];
          usedHeight = bh;
        } else {
          currentBlocks.push(i);
          usedHeight += bh;
        }
      }

      if (currentBlocks.length > 0) {
        if (usedHeight + tailHeight <= maxUsableHeight) {
          bookPages.push({ blockIndices: currentBlocks, includeHeader: isFirstPage, includeTail: true });
        } else {
          bookPages.push({ blockIndices: currentBlocks, includeHeader: isFirstPage, includeTail: false });
          bookPages.push({ blockIndices: [], includeHeader: false, includeTail: true });
        }
      }

      const totalPages = bookPages.length;

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const spec = bookPages[pageIdx];
        const pageSheet = document.createElement('div');
        pageSheet.className = 'print-only print-sheet print-pdf-capture';

        if (spec.includeHeader) {
          if (headerEl) pageSheet.appendChild(headerEl.cloneNode(true));
          if (metaBarEl) pageSheet.appendChild(metaBarEl.cloneNode(true));
        }

        if (spec.blockIndices.length > 0) {
          const bodyWrap = document.createElement('div');
          bodyWrap.className = 'book-report-body';
          for (const bIdx of spec.blockIndices) {
            bodyWrap.appendChild(bookBlocks[bIdx].cloneNode(true));
          }
          pageSheet.appendChild(bodyWrap);
        }

        if (spec.includeTail) {
          if (summaryEl) pageSheet.appendChild(summaryEl.cloneNode(true));
          if (signaturesEl) pageSheet.appendChild(signaturesEl.cloneNode(true));
        }

        if (totalPages > 1) {
          const footer = document.createElement('div');
          footer.className = 'diary-print-page-footer';
          footer.textContent = `${pageFooterPrefix} — पान ${pageIdx + 1} / ${totalPages}`;
          pageSheet.appendChild(footer);
        }

        host.innerHTML = '';
        host.appendChild(pageSheet);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const pageHeight = Math.min(Math.ceil(pageSheet.scrollHeight), A4_HEIGHT_PX);
        const pngDataUrl = await renderSheetNodeToPng(pageSheet, A4_WIDTH_PX, pageHeight);
        const renderedHeightMm = (pageHeight * A4_WIDTH_MM) / A4_WIDTH_PX;

        if (pageIdx > 0) {
          pdf.addPage('a4', 'portrait');
        }
        pdf.addImage(
          pngDataUrl,
          'PNG',
          0,
          0,
          A4_WIDTH_MM,
          Math.min(renderedHeightMm, A4_HEIGHT_MM),
          undefined,
          'FAST'
        );
      }

      pdf.save(fileName);
      return;
    }

    if (!tableEl || !theadEl || tbodyRows.length === 0) {
      const pngDataUrl = await renderSheetNodeToPng(measureClone, A4_WIDTH_PX, fullHeight);
      const scale = Math.min(A4_WIDTH_MM / A4_WIDTH_PX, A4_HEIGHT_MM / fullHeight);
      const imgW = A4_WIDTH_PX * scale;
      const imgH = fullHeight * scale;
      pdf.addImage(pngDataUrl, 'PNG', (A4_WIDTH_MM - imgW) / 2, 0, imgW, imgH, undefined, 'FAST');
      pdf.save(fileName);
      return;
    }

    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height + 10 : 0;
    const theadHeight = theadEl.getBoundingClientRect().height + 2;
    const rowHeights = tbodyRows.map((tr) => Math.ceil(tr.getBoundingClientRect().height));
    const summaryHeight = summaryEl ? Math.ceil(summaryEl.getBoundingClientRect().height) + 12 : 0;
    const signaturesHeight = signaturesEl ? Math.ceil(signaturesEl.getBoundingClientRect().height) + 32 : 0;
    const tailHeight = summaryHeight + signaturesHeight;
    const maxUsableHeight = A4_HEIGHT_PX - CAPTURE_VERTICAL_PADDING_PX - PAGE_FOOTER_RESERVE_PX;

    interface PageSpec {
      rowIndices: number[];
      includeHeader: boolean;
      includeTail: boolean;
    }

    const pages: PageSpec[] = [];
    let currentRows: number[] = [];
    let isFirstPage = true;
    let usedHeight = headerHeight + theadHeight;

    for (let i = 0; i < rowHeights.length; i++) {
      const rh = rowHeights[i];
      if (currentRows.length > 0 && usedHeight + rh > maxUsableHeight) {
        pages.push({ rowIndices: currentRows, includeHeader: isFirstPage, includeTail: false });
        isFirstPage = false;
        currentRows = [i];
        usedHeight = theadHeight + rh;
      } else {
        currentRows.push(i);
        usedHeight += rh;
      }
    }

    if (currentRows.length > 0) {
      if (usedHeight + tailHeight <= maxUsableHeight) {
        pages.push({ rowIndices: currentRows, includeHeader: isFirstPage, includeTail: true });
      } else {
        pages.push({ rowIndices: currentRows, includeHeader: isFirstPage, includeTail: false });
        pages.push({ rowIndices: [], includeHeader: false, includeTail: true });
      }
    }

    const totalPages = pages.length;

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const spec = pages[pageIdx];
      const pageSheet = document.createElement('div');
      pageSheet.className = 'print-only print-sheet print-pdf-capture';

      if (spec.includeHeader && headerEl) {
        pageSheet.appendChild(headerEl.cloneNode(true));
      }

      if (spec.rowIndices.length > 0) {
        const pageTable = document.createElement('table');
        pageTable.className = 'diary-print-table';
        pageTable.appendChild(theadEl.cloneNode(true));
        const pageTbody = document.createElement('tbody');
        for (const rIdx of spec.rowIndices) {
          pageTbody.appendChild(tbodyRows[rIdx].cloneNode(true));
        }
        pageTable.appendChild(pageTbody);
        pageSheet.appendChild(pageTable);
      }

      if (spec.includeTail) {
        if (summaryEl) pageSheet.appendChild(summaryEl.cloneNode(true));
        if (signaturesEl) pageSheet.appendChild(signaturesEl.cloneNode(true));
      }

      if (totalPages > 1) {
        const footer = document.createElement('div');
        footer.className = 'diary-print-page-footer';
        footer.textContent = `${pageFooterPrefix} — पान ${pageIdx + 1} / ${totalPages}`;
        pageSheet.appendChild(footer);
      }

      host.innerHTML = '';
      host.appendChild(pageSheet);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const pageHeight = Math.min(Math.ceil(pageSheet.scrollHeight), A4_HEIGHT_PX);
      const pngDataUrl = await renderSheetNodeToPng(pageSheet, A4_WIDTH_PX, pageHeight);
      const renderedHeightMm = (pageHeight * A4_WIDTH_MM) / A4_WIDTH_PX;

      if (pageIdx > 0) {
        pdf.addPage('a4', 'portrait');
      }
      pdf.addImage(
        pngDataUrl,
        'PNG',
        0,
        0,
        A4_WIDTH_MM,
        Math.min(renderedHeightMm, A4_HEIGHT_MM),
        undefined,
        'FAST'
      );
    }

    pdf.save(fileName);
  } finally {
    host.remove();
  }
}

/**
 * Triggers native browser A4 Print / Save-as-PDF with a custom Marathi PDF document title.
 */
export function printWithDocumentTitle(pdfTitle: string): void {
  const originalTitle = document.title;
  document.title = pdfTitle;

  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    document.title = originalTitle;
    window.removeEventListener('afterprint', restoreTitle);
  };

  window.addEventListener('afterprint', restoreTitle);
  window.print();
  window.setTimeout(restoreTitle, 1500);
}

/**
 * Triggers native browser A4 Print / Save-as-PDF with a clean Marathi PDF document title.
 */
export function printMonthlyDiaryWithTitle(doc: MonthlyDiaryDocument, customFileSuffix?: string): void {
  const pdfTitle = customFileSuffix
    ? `दौरा_दैनंदिनी_${customFileSuffix}`
    : `मासिक_दौरा_दैनंदिनी_${doc.sheetName}`;
  printWithDocumentTitle(pdfTitle);
}

/**
 * Exports a single Monthly Tour Diary to Excel (.xlsx) with exact official Marathi header & columns.
 */
export function exportMonthlyDiaryToExcel(
  doc: MonthlyDiaryDocument,
  holidays: GovernmentHolidayMaster[] = [],
  villages: VillageMaster[] = []
): void {
  const rows: (string | number)[][] = [
    ['मासिक दौरा दैनंदिनी'],
    [`${doc.designation} ${doc.employeeName}`],
    [doc.officeName],
    [`महिना: ${doc.monthLabelMarathi}`],
    [],
    ['अनुक्रमांक', 'दिनांक', 'कोठून', 'कोठे', 'प्रवासाचा प्रकार', 'अंतर (किमी)', 'कामाचे स्वरूप व सविस्तर नोंदी'],
  ];

  let totalKm = 0;
  for (const entry of doc.entries) {
    const display = resolveHolidayEntryDisplay(entry, holidays);
    const travel = resolveDiaryEntryTravel(entry, display.toPlace, villages);
    const detailedNotes = parseDetailedWorkNotes(display.notes);
    const fullWorkText =
      detailedNotes.length > 0
        ? `${display.workDescription} (${detailedNotes.map((n, idx) => `${idx + 1}. ${n}`).join('; ')})`
        : display.workDescription;

    totalKm += travel.distanceKm;
    rows.push([
      entry.serialNo,
      `${formatDateDDMMYYYY(entry.date)} (${entry.dayNameMarathi})`,
      entry.fromPlace,
      display.toPlace,
      travel.travelMode,
      travel.distanceKm > 0 ? travel.distanceKm : '—',
      fullWorkText,
    ]);
  }
  totalKm = Math.round(totalKm * 10) / 10;

  rows.push([]);
  rows.push([
    'सारांश',
    `एकूण दिवस: ${doc.summary.totalDays}`,
    `कामकाज: ${doc.summary.workingDays}`,
    `रविवार/सुट्ट्या: ${doc.summary.sundays + doc.summary.holidays}`,
    `रजा: ${doc.summary.leaves}`,
    `एकूण: ${totalKm} किमी`,
    `विशेष कार्यक्रम: ${doc.summary.specialEvents}`,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
  ];
  ws['!cols'] = [
    { wch: 11 },
    { wch: 24 },
    { wch: 13 },
    { wch: 32 },
    { wch: 15 },
    { wch: 13 },
    { wch: 56 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, doc.sheetName.slice(0, 31));
  XLSX.writeFile(wb, `मासिक_दौरा_दैनंदिनी_${doc.sheetName}.xlsx`);
}

/**
 * Exports a Financial Year Summary report to Excel (.xlsx).
 */
export function exportAnnualReportToExcel(
  fyLabel: string,
  diaries: MonthlyDiaryDocument[],
  employeeName: string,
  officeName: string
): void {
  const rows: (string | number)[][] = [
    ['वार्षिक मासिक दौरा दैनंदिनी गोषवारा अहवाल'],
    [`आरोग्य सहाय्यक: ${employeeName} — ${officeName}`],
    [fyLabel],
    [],
    [
      'महिना',
      'एकूण दिवस',
      'कामकाजाचे दिवस',
      'गाव सत्रे',
      'बैठका',
      'कार्यालयीन कामकाज',
      'विशेष कार्यक्रम',
      'रविवार',
      'शासकीय सुट्ट्या',
      'रजा',
      'सुट्टी समायोजन',
    ],
  ];

  for (const d of diaries) {
    rows.push([
      d.monthLabelMarathi,
      d.summary.totalDays,
      d.summary.workingDays,
      d.summary.villageTours,
      d.summary.meetings,
      d.summary.officeDays,
      d.summary.specialEvents,
      d.summary.sundays,
      d.summary.holidays,
      d.summary.leaves,
      d.summary.adjustedDays,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
  ];
  ws['!cols'] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 11 },
    { wch: 10 },
    { wch: 16 },
    { wch: 15 },
    { wch: 10 },
    { wch: 14 },
    { wch: 9 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Annual_Summary');
  XLSX.writeFile(wb, `वार्षिक_अहवाल_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Triggers a JSON download for full database backup.
 */
export function downloadJsonBackup(data: Record<string, unknown>): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PHC_Bhada_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
