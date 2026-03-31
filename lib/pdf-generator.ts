import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { toThaiText } from './thai-number';

export interface ChargeRecord {
  id: string;
  serviceName: string;
  serviceType: string;
  chargeType: 'foreign' | 'domestic';
  thbAmount: number;
  usdAmount?: number;
  exchangeRate?: number;
}

interface FieldConfig {
  x: number;
  y: number;
  fontSize: number;
  align?: string;
  bold?: boolean;
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

interface DocumentConfig {
  name: string;
  referenceImage: string;
  pageWidth: number;
  pageHeight: number;
  taxRate: number;
  font: string;
  boldFont: string;
  fields: Record<string, FieldConfig>;
  lineItems: LineItemConfig | Record<string, never>;
}

interface TemplateConfig {
  chargeTypes: Record<string, { label: string; documents: string[] }>;
  documents: Record<string, DocumentConfig>;
}

function splitBahtSatang(amount: number): { baht: number; satang: number } {
  const rounded = Math.round(amount * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);
  return { baht, satang };
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function drawTextField(
  doc: PDFKit.PDFDocument,
  text: string,
  field: FieldConfig,
  regularFont: string,
  boldFont: string
): void {
  const font = field.bold ? boldFont : regularFont;
  doc.font(font).fontSize(field.fontSize);

  if (field.align === 'right') {
    // Draw right-aligned by measuring text width
    const w = doc.widthOfString(text);
    doc.text(text, field.x - w, field.y, { lineBreak: false });
  } else {
    doc.text(text, field.x, field.y, { lineBreak: false });
  }
}

async function generateDocumentPage(
  doc: PDFKit.PDFDocument,
  docConfig: DocumentConfig,
  records: ChargeRecord[],
  isFirstPage: boolean
): Promise<void> {
  const cwd = process.cwd();
  const regularFont = path.resolve(cwd, docConfig.font);
  const boldFont = path.resolve(cwd, docConfig.boldFont);

  if (!isFirstPage) {
    doc.addPage({ size: [docConfig.pageWidth, docConfig.pageHeight], margin: 0 });
  }

  // White background (blank — text only for printing on pre-printed form)
  doc.rect(0, 0, docConfig.pageWidth, docConfig.pageHeight).fill('white');

  const fields = docConfig.fields;
  const liConfig = docConfig.lineItems as LineItemConfig;

  if (!fields || Object.keys(fields).length === 0 || !liConfig || !liConfig.startY) {
    // Template not yet configured — leave blank page
    doc.font(regularFont).fontSize(12).fillColor('red')
      .text(`[${docConfig.name} — template positions not yet configured]`, 50, 50, { lineBreak: false });
    doc.fillColor('black');
    return;
  }

  const taxRate = docConfig.taxRate;

  // Compute per-record WHT amounts
  const recordAmounts = records.map((r) => {
    const wht = (r.thbAmount * taxRate) / (100 - taxRate);
    return { record: r, wht };
  });

  const totalCredit = records.reduce((s, r) => s + r.thbAmount, 0);
  const totalWht = recordAmounts.reduce((s, r) => s + r.wht, 0);

  // Draw line items (CREDIT side)
  recordAmounts.forEach(({ record, wht }, idx) => {
    const y = liConfig.startY + idx * liConfig.lineHeight;

    // Description line: "1. SERVICE - type (USD X)" or "1. SERVICE - type"
    let desc = `${idx + 1}. ${record.serviceName} - ${record.serviceType}`;
    if (record.chargeType === 'foreign' && record.usdAmount) {
      desc += `  (USD ${record.usdAmount})`;
    }

    doc.font(regularFont).fontSize(liConfig.fontSize).fillColor('black')
      .text(desc, liConfig.descriptionX, y, { lineBreak: false });

    // Formula line (below description)
    let formula = '';
    if (record.chargeType === 'foreign' && record.usdAmount && record.exchangeRate) {
      const gross = record.thbAmount;
      formula = `(${record.exchangeRate}*${record.usdAmount}*${taxRate}/95)=${wht.toFixed(2)}`;
    } else {
      formula = `(${record.thbAmount.toFixed(2)}*${taxRate}/${100 - taxRate})=${wht.toFixed(2)}`;
    }
    doc.font(regularFont).fontSize(liConfig.formulaFontSize).fillColor('black')
      .text(formula, liConfig.descriptionX, y + liConfig.formulaOffsetY, { lineBreak: false });

    // Credit amount (net THB)
    const { baht, satang } = splitBahtSatang(record.thbAmount);
    const creditBahtW = doc.font(regularFont).fontSize(liConfig.fontSize).widthOfString(baht.toString());
    doc.text(baht.toString(), liConfig.creditBahtX - creditBahtW, y, { lineBreak: false });
    const satangStr = pad2(satang);
    doc.text(satangStr, liConfig.creditSatangX, y, { lineBreak: false });
  });

  // WHT debit total (sum of WHT = debit side)
  const { baht: whtBaht, satang: whtSatang } = splitBahtSatang(totalWht);
  drawTextField(doc, whtBaht.toString(), fields.wht_debit_baht, regularFont, boldFont);
  drawTextField(doc, pad2(whtSatang), fields.wht_debit_satang, regularFont, boldFont);

  // TOTAL row
  const { baht: totalCreditBaht, satang: totalCreditSatang } = splitBahtSatang(totalCredit);
  const { baht: totalDebitBaht, satang: totalDebitSatang } = splitBahtSatang(totalWht);

  drawTextField(doc, totalDebitBaht.toString(), fields.total_debit_baht, regularFont, boldFont);
  drawTextField(doc, pad2(totalDebitSatang), fields.total_debit_satang, regularFont, boldFont);
  drawTextField(doc, totalCreditBaht.toString(), fields.total_credit_baht, regularFont, boldFont);
  drawTextField(doc, pad2(totalCreditSatang), fields.total_credit_satang, regularFont, boldFont);

  // Amount in Thai words (credit total)
  drawTextField(doc, toThaiText(totalCredit), fields.amount_words, regularFont, boldFont);

  // Department
  if (fields.department) {
    drawTextField(doc, 'E-Business & Digital Media', fields.department, regularFont, boldFont);
  }
}

export async function generateCombinedPdf(records: ChargeRecord[]): Promise<Buffer> {
  const configPath = path.resolve(process.cwd(), 'config/templates.json');
  const config: TemplateConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Determine which documents are needed
  const neededDocs = new Set<string>();
  for (const record of records) {
    const chargeConfig = config.chargeTypes[record.chargeType];
    if (chargeConfig) {
      chargeConfig.documents.forEach((d) => neededDocs.add(d));
    }
  }

  // Order: credit_card → pnd54 → ppnd36
  const docOrder = ['credit_card', 'pnd54', 'ppnd36'].filter((d) => neededDocs.has(d));

  // Get page size from first doc
  const firstDocKey = docOrder[0];
  const firstDoc = config.documents[firstDocKey];

  const doc = new PDFDocument({
    size: [firstDoc.pageWidth, firstDoc.pageHeight],
    margin: 0,
    autoFirstPage: true,
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  for (let i = 0; i < docOrder.length; i++) {
    const docKey = docOrder[i];
    const docConfig = config.documents[docKey];

    // Filter records that need this document
    const relevantRecords = records.filter((r) =>
      config.chargeTypes[r.chargeType].documents.includes(docKey)
    );

    if (relevantRecords.length === 0) continue;

    await generateDocumentPage(doc, docConfig, relevantRecords, i === 0);
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
