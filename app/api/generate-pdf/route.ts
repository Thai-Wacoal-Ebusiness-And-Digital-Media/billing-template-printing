import { NextRequest, NextResponse } from 'next/server';
import { generateCombinedPdf, ChargeRecord } from '@/lib/pdf-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const records: ChargeRecord[] = body.records;
    const department: string = body.department ?? 'E-Business & Digital Media';

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No charge records provided' }, { status: 400 });
    }

    const pdfBuffer = await generateCombinedPdf(records, department);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="payment-voucher.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
