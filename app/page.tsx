'use client';

import { useState, useCallback } from 'react';

interface ChargeRecord {
  id: string;
  serviceName: string;
  serviceType: string;
  chargeType: 'foreign' | 'domestic';
  thbAmount: number;
  usdAmount?: number;
  exchangeRate?: number;
}

const DOC_LABELS: Record<string, string> = {
  credit_card: 'จ่ายบัตรเครดิต',
  pnd54: 'ภ.ง.ด.54',
  ppnd36: 'ภ.พ.36',
};

const CHARGE_DOCS: Record<string, string[]> = {
  foreign: ['credit_card', 'pnd54', 'ppnd36'],
  domestic: ['credit_card', 'ppnd36'],
};

const WHT_RATE = 5;
const VAT_RATE = 7;

function calcWht(thbAmount: number): number {
  return Math.round((thbAmount * WHT_RATE) / (100 - WHT_RATE) * 100) / 100;
}
function calcVat(thbAmount: number, chargeType: 'foreign' | 'domestic' = 'foreign'): number {
  const wht = chargeType === 'domestic' ? 0 : calcWht(thbAmount);
  return Math.round((thbAmount + wht) * VAT_RATE / 100 * 100) / 100;
}
function calcTotalPaid(thbAmount: number, chargeType: 'foreign' | 'domestic' = 'foreign'): number {
  const wht = chargeType === 'domestic' ? 0 : calcWht(thbAmount);
  return Math.round((thbAmount + wht) * 100) / 100;
}

function newRecord(id?: string): ChargeRecord {
  return {
    id: id ?? crypto.randomUUID(),
    serviceName: '',
    serviceType: 'ค่าบริการ',
    chargeType: 'foreign',
    thbAmount: 0,
    usdAmount: undefined,
    exchangeRate: undefined,
  };
}

const INITIAL_RECORD = newRecord('initial');

export default function Home() {
  const [records, setRecords] = useState<ChargeRecord[]>([INITIAL_RECORD]);
  const [department, setDepartment] = useState('E-Business & Digital Media');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((id: string, patch: Partial<ChargeRecord>) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRecord = () => setRecords((prev) => [...prev, newRecord()]);
  const removeRecord = (id: string) =>
    setRecords((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const neededDocs = [...new Set(records.flatMap((r) => CHARGE_DOCS[r.chargeType]))];
  const docOrder = ['credit_card', 'pnd54', 'ppnd36'].filter((d) => neededDocs.includes(d));

  const handleGenerate = async () => {
    setError(null);
    const invalid = records.find((r) => !r.serviceName.trim() || r.thbAmount <= 0);
    if (invalid) {
      setError('กรุณากรอก Service Name และ THB Amount ให้ครบทุกรายการ');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, department }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payment-voucher.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const totalPaidSum = records.reduce((s, r) => s + calcTotalPaid(r.thbAmount, r.chargeType), 0);
  const totalWhtSum = records.filter(r => r.chargeType === 'foreign').reduce((s, r) => s + calcWht(r.thbAmount), 0);
  const totalVatSum = records.reduce((s, r) => s + calcVat(r.thbAmount, r.chargeType), 0);
  const subtotalSum = records.reduce((s, r) => s + r.thbAmount, 0);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="bg-surface dark:bg-stone-950 flex justify-between items-center w-full px-8 py-4 sticky top-0 z-50 shadow-sm dark:shadow-none border-b border-outline-variant/60 dark:border-stone-800">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold font-headline italic pr-2 text-primary dark:text-[#d48451]">
            Payment Voucher Generator
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={addRecord} className="px-5 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-all active:scale-[0.99] flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">add</span>
            Add Record
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/10 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            {loading ? 'Generating...' : 'Generate PDF'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="font-headline text-4xl italic text-on-background">Voucher Templates</h1>
                <p className="text-secondary font-body mt-2">Thai Wacoal PLC — E-Business & Digital Media</p>
              </div>
              <div className="flex gap-2">
                {docOrder.map(d => (
                  <span key={d} className="px-3 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {DOC_LABELS[d]}
                  </span>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium flex items-center gap-2 border border-error/20">
                <span className="material-symbols-outlined">error</span>
                {error}
              </div>
            )}

            <div className="space-y-8">
              <div className="bg-surface-container-lowest rounded-xl shadow-soft p-8 border border-outline-variant/60 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-headline text-2xl text-on-background">Charge Records</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[11px] font-bold text-secondary uppercase tracking-widest border-b border-outline-variant/40">
                        <th className="pb-4 px-2">Service Name</th>
                        <th className="pb-4 px-2">Service Type</th>
                        <th className="pb-4 px-2">Charge Type</th>
                        <th className="pb-4 px-2 text-right">Amount (THB)</th>
                        <th className="pb-4 px-2 text-right">USD</th>
                        <th className="pb-4 px-2 text-right text-tertiary">WHT (5/95)</th>
                        <th className="pb-4 px-2 text-right text-on-primary-fixed-variant">VAT (7%)</th>
                        <th className="pb-4 px-2 text-right">Total Paid</th>
                        <th className="pb-4 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {records.map(r => {
                        const wht = r.chargeType === 'domestic' ? 0 : calcWht(r.thbAmount);
                        const vat = calcVat(r.thbAmount, r.chargeType);
                        const totalPaid = calcTotalPaid(r.thbAmount, r.chargeType);
                        return (
                          <tr key={r.id} className="group hover:bg-surface-container-low/30 transition-colors">
                            <td className="py-4 px-2">
                              <input
                                className="w-full bg-surface-container-low border border-transparent focus:border-primary/40 rounded-lg text-sm font-body px-3 py-2 focus:bg-white transition-colors focus:outline-none"
                                placeholder="e.g. AWS"
                                type="text"
                                value={r.serviceName}
                                onChange={(e) => update(r.id, { serviceName: e.target.value })}
                              />
                            </td>
                            <td className="py-4 px-2">
                              <input
                                className="w-full bg-surface-container-low border border-transparent focus:border-primary/40 rounded-lg text-sm font-body px-3 py-2 text-left focus:bg-white transition-colors focus:outline-none"
                                type="text"
                                placeholder="ค่าบริการ"
                                value={r.serviceType}
                                onChange={(e) => update(r.id, { serviceType: e.target.value })}
                              />
                            </td>
                            <td className="py-4 px-2">
                              <select
                                className="w-full bg-surface-container-low border border-transparent focus:border-primary/40 rounded-lg text-sm font-body px-3 py-2 focus:bg-white transition-colors focus:outline-none appearance-none cursor-pointer"
                                value={r.chargeType}
                                onChange={(e) => update(r.id, { chargeType: e.target.value as 'foreign' | 'domestic' })}
                              >
                                <option value="foreign">Foreign (USD)</option>
                                <option value="domestic">Domestic (THB)</option>
                              </select>
                            </td>
                            <td className="py-4 px-2 text-right">
                              <input
                                className="w-24 bg-surface-container-low border border-transparent focus:border-primary/40 rounded-lg text-sm font-body px-3 py-2 text-right focus:bg-white transition-colors focus:outline-none"
                                type="number"
                                step="any"
                                value={r.thbAmount || ''}
                                onChange={(e) => update(r.id, { thbAmount: parseFloat(e.target.value) || 0 })}
                              />
                            </td>
                            <td className="py-4 px-2 text-right">
                              {r.chargeType === 'foreign' && (
                                <input
                                  className="w-20 bg-surface-container-low border border-transparent focus:border-primary/40 rounded-lg text-sm font-body px-3 py-2 text-right focus:bg-white transition-colors focus:outline-none"
                                  type="number"
                                  step="any"
                                  value={r.usdAmount ?? ''}
                                  onChange={(e) => update(r.id, { usdAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                                />
                              )}
                            </td>
                            <td className="py-4 px-2 text-right font-mono text-tertiary">
                              {r.chargeType === 'domestic' ? '—' : (r.thbAmount > 0 ? wht.toFixed(2) : '—')}
                            </td>
                            <td className="py-4 px-2 text-right font-mono text-on-primary-fixed-variant">
                              {r.thbAmount > 0 ? vat.toFixed(2) : '—'}
                            </td>
                            <td className="py-4 px-2 text-right font-mono font-bold text-on-background">
                              {r.thbAmount > 0 ? totalPaid.toFixed(2) : '—'}
                            </td>
                            <td className="py-4 px-2 text-right">
                              <button
                                onClick={() => removeRecord(r.id)}
                                className="text-outline hover:text-error transition-colors p-1"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-container-highest rounded-xl p-8 border border-outline-variant/60">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div>
                    <h3 className="font-headline text-xl text-on-background mb-6">Financial Summary</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-secondary">Subtotal Amount</span>
                        <span className="font-mono font-semibold">{subtotalSum.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-secondary">ภ.ง.ด.54 — WHT (5/95)</span>
                        <span className="font-mono font-semibold text-tertiary">{totalWhtSum.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-secondary">ภ.พ.36 — VAT (7%)</span>
                        <span className="font-mono font-semibold text-on-primary-fixed-variant">{totalVatSum.toFixed(2)}</span>
                      </div>
                      <div className="pt-4 border-t border-outline-variant flex justify-between items-end">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-widest text-primary">Credit Card Slip Total</span>
                          <p className="text-4xl font-headline text-on-background italic block pt-1">{totalPaidSum.toFixed(2)}</p>
                        </div>
                        <span className="text-sm text-secondary mb-1 font-bold">THB</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-6">
                    <div>
                      <h3 className="font-headline text-xl text-on-background mb-6">Department</h3>
                      <input
                        className="w-full bg-surface-container-low border border-transparent focus:border-primary/40 rounded-lg text-sm font-body px-3 py-2 focus:bg-white transition-colors focus:outline-none"
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Department name"
                      />
                    </div>
                    <div className="space-y-3">
                      <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
                      >
                        <span className="material-symbols-outlined">picture_as_pdf</span>
                        {loading ? 'Generating PDF...' : 'Generate PDF Voucher'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="pt-8 border-t border-outline-variant/40">
                <p className="font-sans text-[10px] uppercase tracking-widest text-secondary text-center">
                  Payment Voucher Generator — Built for Thai Wacoal PLC E-Business & Digital Media
                </p>
                <p className="font-sans text-[10px] text-outline text-center mt-1">v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
              </footer>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
