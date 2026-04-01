import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { toThaiText } from './thai-number';

export interface ChargeRecord {
  id: string;
  serviceName: string;
  serviceType: string;
  chargeType: 'foreign' | 'domestic';
  thbAmount: number;       // Net THB amount (service cost)
  usdAmount?: number;      // For display in description line
  exchangeRate?: number;   // For display purposes
}

// Computed amounts per record
interface RecordAmounts {
  record: ChargeRecord;
  thbNet: number;          // = record.thbAmount
  wht: number;             // = thbNet * whtRate / (100 - whtRate)
  totalPaid: number;       // = thbNet + wht
  vat: number;             // = totalPaid * vatRate / 100
}

interface FieldPos {
  x: number;
  y: number;
  fontSize: number;
  align?: string;
  bold?: boolean;
}

interface Positions {
  debit_desc: FieldPos;
  wht_debit_baht: FieldPos;
  wht_debit_satang: FieldPos;
  amount_words: FieldPos;
  total_debit_baht: FieldPos;
  total_debit_satang: FieldPos;
  total_credit_baht: FieldPos;
  total_credit_satang: FieldPos;
  department: FieldPos;
}

interface LineItemConfig {
  startY: number;
  lineHeight: number;
  descriptionX: number;
  formulaOffsetY: number;
  creditBahtX: number;
  creditSatangX: number;
  fontSize: number;
  formulaFontSize: number;
}

interface FormTemplate {
  referenceImage: string;
  pageWidth: number;   // reference PNG width in px (coordinate space)
  pageHeight: number;  // reference PNG height in px (coordinate space)
  paperWidthMm?: number;   // actual print paper width in mm
  paperHeightMm?: number;  // actual print paper height in mm
  font: string;
  boldFont: string;
  positions: Positions;
  lineItems: LineItemConfig;
}

interface DocumentDef {
  name: string;
  debitLabel: string;
  debitCalc: 'totalPaid' | 'totalWHT' | 'totalVAT';
  creditCalc: 'service' | 'wht' | 'vat';
  formulaType: 'none' | 'wht' | 'vat';
  extraCreditLine?: string;
  extraCreditCalc?: 'totalWHT';
  whtRate: number;
  vatRate?: number;
}

interface TemplateConfig {
  chargeTypes: Record<string, { label: string; documents: string[] }>;
  formTemplate: FormTemplate;
  documents: Record<string, DocumentDef>;
}

// ─── helpers ───────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function splitBahtSatang(amount: number): { baht: number; satang: number } {
  const r = round2(amount);
  const baht = Math.floor(r);
  return { baht, satang: Math.round((r - baht) * 100) };
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function computeAmounts(r: ChargeRecord, whtRate: number, vatRate: number): RecordAmounts {
  const thbNet = r.thbAmount;
  const wht = round2((thbNet * whtRate) / (100 - whtRate));
  const totalPaid = round2(thbNet + wht);
  const vat = round2(totalPaid * vatRate / 100);
  return { record: r, thbNet, wht, totalPaid, vat };
}

function drawAt(
  doc: PDFKit.PDFDocument,
  text: string,
  pos: FieldPos,
  regularFont: string,
  boldFont: string
): void {
  doc.font(pos.bold ? boldFont : regularFont).fontSize(pos.fontSize).fillColor('black');
  if (pos.align === 'right') {
    const w = doc.widthOfString(text);
    doc.text(text, pos.x - w, pos.y, { lineBreak: false });
  } else {
    doc.text(text, pos.x, pos.y, { lineBreak: false });
  }
}

function drawCredit(
  doc: PDFKit.PDFDocument,
  amount: number,
  y: number,
  li: LineItemConfig,
  regularFont: string
): void {
  const { baht, satang } = splitBahtSatang(amount);
  doc.font(regularFont).fontSize(li.fontSize).fillColor('black');
  const w = doc.widthOfString(baht.toString());
  doc.text(baht.toString(), li.creditBahtX - w, y, { lineBreak: false });
  doc.text(pad2(satang), li.creditSatangX, y, { lineBreak: false });
}

// ─── page renderer ──────────────────────────────────────────────────────────

function renderPage(
  doc: PDFKit.PDFDocument,
  form: FormTemplate,
  docDef: DocumentDef,
  amounts: RecordAmounts[],
  _isFirst: boolean   // page management handled by caller
): void {
  const cwd = process.cwd();
  const regularFont = path.resolve(cwd, form.font);
  const boldFont = path.resolve(cwd, form.boldFont);
  const pos = form.positions;
  const li = form.lineItems;
  const whtRate = docDef.whtRate;
  const vatRate = docDef.vatRate ?? 7;

  // White background (drawn in the reference PNG coordinate space — transform handles scaling)
  doc.rect(0, 0, form.pageWidth, form.pageHeight).fill('white');

  // ── Document title (for on-screen ID) ──────────────────────────────────
  // doc.font(boldFont).fontSize(16).fillColor('#333333')
  //   .text(docDef.name, 40, 40, { lineBreak: false });

  // ── Compute totals ──────────────────────────────────────────────────────
  const totalWHT = round2(amounts.reduce((s, a) => s + a.wht, 0));
  const totalPaid = round2(amounts.reduce((s, a) => s + a.totalPaid, 0));
  const totalVAT = round2(amounts.reduce((s, a) => s + a.vat, 0));
  const totalService = round2(amounts.reduce((s, a) => s + a.thbNet, 0));

  const debitTotal =
    docDef.debitCalc === 'totalPaid' ? totalPaid :
      docDef.debitCalc === 'totalWHT' ? totalWHT :
        totalVAT;

  // ── Debit description + amount ──────────────────────────────────────────
  drawAt(doc, docDef.debitLabel, pos.debit_desc, regularFont, boldFont);

  const { baht: dBaht, satang: dSatang } = splitBahtSatang(debitTotal);
  drawAt(doc, dBaht.toString(), pos.wht_debit_baht, regularFont, boldFont);
  drawAt(doc, pad2(dSatang), pos.wht_debit_satang, regularFont, boldFont);

  // ── Credit line items ───────────────────────────────────────────────────
  let lineIdx = 0;

  amounts.forEach((a, idx) => {
    const y = li.startY + lineIdx * li.lineHeight;

    // Description
    let desc = `${idx + 1}. ${a.record.serviceName} - ${a.record.serviceType}`;
    if (a.record.chargeType === 'foreign' && a.record.usdAmount) {
      desc += `  (USD ${a.record.usdAmount})`;
    }
    doc.font(regularFont).fontSize(li.fontSize).fillColor('black')
      .text(desc, li.descriptionX, y, { lineBreak: false });

    // Formula line
    if (docDef.formulaType === 'wht') {
      const formula = `(${a.thbNet.toFixed(2)}*${whtRate}/${100 - whtRate})=${a.wht.toFixed(2)}`;
      doc.font(regularFont).fontSize(li.formulaFontSize).fillColor('black')
        .text(formula, li.descriptionX, y + li.formulaOffsetY, { lineBreak: false });
    } else if (docDef.formulaType === 'vat') {
      const formula = `(${a.thbNet.toFixed(2)}+${a.wht.toFixed(2)})*${vatRate}/100=${a.vat.toFixed(2)}`;
      doc.font(regularFont).fontSize(li.formulaFontSize).fillColor('black')
        .text(formula, li.descriptionX, y + li.formulaOffsetY, { lineBreak: false });
    }

    // Credit amount
    const creditAmt =
      docDef.creditCalc === 'service' ? a.thbNet :
        docDef.creditCalc === 'wht' ? a.wht :
          a.vat;

    drawCredit(doc, creditAmt, y, li, regularFont);
    lineIdx++;
  });

  // Extra credit line (ชุดที่ 1 only — Acc.Withholding WHT line)
  if (docDef.extraCreditLine && docDef.extraCreditCalc) {
    const y = li.startY + lineIdx * li.lineHeight;
    doc.font(regularFont).fontSize(li.fontSize).fillColor('black')
      .text(docDef.extraCreditLine, li.descriptionX, y, { lineBreak: false });
    const extraAmt = docDef.extraCreditCalc === 'totalWHT' ? totalWHT : 0;
    drawCredit(doc, extraAmt, y, li, regularFont);
    lineIdx++;
  }

  // ── Department ──────────────────────────────────────────────────────────
  drawAt(doc, 'E-Business & Digital Media', pos.department, regularFont, boldFont);

  // ── Total row ───────────────────────────────────────────────────────────
  const { baht: tBaht, satang: tSatang } = splitBahtSatang(debitTotal);
  drawAt(doc, tBaht.toString(), pos.total_debit_baht, regularFont, boldFont);
  drawAt(doc, pad2(tSatang), pos.total_debit_satang, regularFont, boldFont);
  drawAt(doc, tBaht.toString(), pos.total_credit_baht, regularFont, boldFont);
  drawAt(doc, pad2(tSatang), pos.total_credit_satang, regularFont, boldFont);

  // ── Thai words ──────────────────────────────────────────────────────────
  drawAt(doc, toThaiText(debitTotal), pos.amount_words, regularFont, boldFont);
}

// ─── public entry point ─────────────────────────────────────────────────────

const MM_TO_PT = 72 / 25.4; // 1 mm = 72/25.4 PDF points

export async function generateCombinedPdf(records: ChargeRecord[]): Promise<Buffer> {
  const configPath = path.resolve(process.cwd(), 'config/templates.json');
  const config: TemplateConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const form = config.formTemplate;

  // Compute actual PDF page size in points from mm (fallback to px dimensions)
  const pdfW = form.paperWidthMm  ? form.paperWidthMm  * MM_TO_PT : form.pageWidth;
  const pdfH = form.paperHeightMm ? form.paperHeightMm * MM_TO_PT : form.pageHeight;

  // Scale factors: map reference PNG coordinate space → PDF point space
  const scaleX = pdfW / form.pageWidth;
  const scaleY = pdfH / form.pageHeight;

  // Which documents are needed across all records
  const neededDocs = new Set<string>();
  for (const r of records) {
    (config.chargeTypes[r.chargeType]?.documents ?? []).forEach(d => neededDocs.add(d));
  }
  const docOrder = ['credit_card', 'pnd54', 'ppnd36'].filter(d => neededDocs.has(d));

  const pdfDoc = new PDFDocument({
    size: [pdfW, pdfH],
    margin: 0,
    autoFirstPage: true,
  });

  const chunks: Buffer[] = [];
  pdfDoc.on('data', (c: Buffer) => chunks.push(c));

  for (let i = 0; i < docOrder.length; i++) {
    const docKey = docOrder[i];
    const docDef = config.documents[docKey];

    const relevant = records.filter(r =>
      config.chargeTypes[r.chargeType].documents.includes(docKey)
    );
    if (relevant.length === 0) continue;

    const whtRate = docDef.whtRate ?? 5;
    const vatRate = docDef.vatRate ?? 7;
    const amounts = relevant.map(r => computeAmounts(r, whtRate, vatRate));

    // Apply scale transform so all existing pixel coordinates map correctly
    if (i > 0) {
      pdfDoc.addPage({ size: [pdfW, pdfH], margin: 0 });
    }
    pdfDoc.save();
    pdfDoc.transform(scaleX, 0, 0, scaleY, 0, 0);
    renderPage(pdfDoc, form, docDef, amounts, true /* page already added */);
    pdfDoc.restore();
  }

  pdfDoc.end();
  return new Promise(resolve => {
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
