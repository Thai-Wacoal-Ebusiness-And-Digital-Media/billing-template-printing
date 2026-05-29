import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const MM_TO_PT = 72 / 25.4;

interface FieldPos {
  x: number;
  y: number;
  fontSize: number;
  align?: string;
  bold?: boolean;
}

export async function GET() {
  try {
    const configPath = path.resolve(process.cwd(), 'config/templates.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const form = config.formTemplate;

    const pdfW = form.paperWidthMm ? form.paperWidthMm * MM_TO_PT : form.pageWidth;
    const pdfH = form.paperHeightMm ? form.paperHeightMm * MM_TO_PT : form.pageHeight;
    const scaleX = pdfW / form.pageWidth;
    const scaleY = pdfH / form.pageHeight;

    const regularFont = path.resolve(process.cwd(), form.font);

    const pdfDoc = new PDFDocument({
      size: [pdfW, pdfH],
      margin: 0,
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    pdfDoc.on('data', (c: Buffer) => chunks.push(c));

    pdfDoc.save();
    pdfDoc.transform(scaleX, 0, 0, scaleY, 0, 0);

    // Draw white background
    pdfDoc.rect(0, 0, form.pageWidth, form.pageHeight).fill('white');

    // Draw crosshair markers at each position
    const positions = form.positions as Record<string, FieldPos>;
    for (const [name, pos] of Object.entries(positions)) {
      const x = pos.x;
      const y = pos.y;

      // Draw crosshair
      pdfDoc.save();
      pdfDoc.strokeColor('red').lineWidth(0.5);
      pdfDoc.moveTo(x - 15, y).lineTo(x + 15, y).stroke();
      pdfDoc.moveTo(x, y - 15).lineTo(x, y + 15).stroke();
      pdfDoc.circle(x, y, 3).stroke();

      // Label
      pdfDoc.font(regularFont).fontSize(8).fillColor('red');
      pdfDoc.text(`${name} (${x},${y})`, x + 5, y - 15, { lineBreak: false });
      pdfDoc.restore();
    }

    // Draw line items positions (first 5 rows)
    const li = form.lineItems;
    for (let i = 0; i < 5; i++) {
      const y = li.startY + i * li.lineHeight;

      // Description position marker
      pdfDoc.save();
      pdfDoc.strokeColor('blue').lineWidth(0.5);
      pdfDoc.moveTo(li.descriptionX - 15, y).lineTo(li.descriptionX + 15, y).stroke();
      pdfDoc.moveTo(li.descriptionX, y - 8).lineTo(li.descriptionX, y + 8).stroke();

      // Full-width row guide line
      pdfDoc.strokeColor('blue').lineWidth(0.3).opacity(0.3);
      pdfDoc.moveTo(0, y).lineTo(form.pageWidth, y).stroke();
      pdfDoc.opacity(1);

      // Credit baht position marker
      pdfDoc.strokeColor('green').lineWidth(0.5);
      pdfDoc.moveTo(li.creditBahtX - 10, y).lineTo(li.creditBahtX + 10, y).stroke();
      pdfDoc.moveTo(li.creditBahtX, y - 8).lineTo(li.creditBahtX, y + 8).stroke();

      // Credit satang position marker
      pdfDoc.strokeColor('orange').lineWidth(0.5);
      pdfDoc.moveTo(li.creditSatangX - 5, y).lineTo(li.creditSatangX + 5, y).stroke();
      pdfDoc.moveTo(li.creditSatangX, y - 8).lineTo(li.creditSatangX, y + 8).stroke();

      // Row label
      pdfDoc.font(regularFont).fontSize(8).fillColor('blue');
      pdfDoc.text(`row${i + 1} y=${y}`, 10, y - 5, { lineBreak: false });
      pdfDoc.restore();
    }

    // Draw horizontal guide lines for key positions
    const guideLines = [
      { y: (positions.debit_desc as FieldPos).y, label: 'debit_desc', color: 'red' },
      { y: (positions.department as FieldPos).y, label: 'department', color: 'purple' },
      { y: (positions.amount_words as FieldPos).y, label: 'total/words', color: 'green' },
    ];

    for (const guide of guideLines) {
      pdfDoc.save();
      pdfDoc.strokeColor(guide.color).lineWidth(0.3).opacity(0.4);
      pdfDoc.moveTo(0, guide.y).lineTo(form.pageWidth, guide.y).stroke();
      pdfDoc.restore();
    }

    // Draw 10mm grid for measurement
    const mmToPx_x = form.pageWidth / (form.paperWidthMm || 210);
    const mmToPx_y = form.pageHeight / (form.paperHeightMm || 153);

    pdfDoc.save();
    pdfDoc.strokeColor('#cccccc').lineWidth(0.2).opacity(0.5);
    for (let mm = 0; mm <= (form.paperWidthMm || 210); mm += 10) {
      const x = mm * mmToPx_x;
      pdfDoc.moveTo(x, 0).lineTo(x, form.pageHeight).stroke();
    }
    for (let mm = 0; mm <= (form.paperHeightMm || 153); mm += 10) {
      const y = mm * mmToPx_y;
      pdfDoc.moveTo(0, y).lineTo(form.pageWidth, y).stroke();
    }
    pdfDoc.restore();

    pdfDoc.restore();
    pdfDoc.end();

    const buffer = await new Promise<Buffer>(resolve => {
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="calibration.pdf"',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Calibration PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate calibration PDF' }, { status: 500 });
  }
}
