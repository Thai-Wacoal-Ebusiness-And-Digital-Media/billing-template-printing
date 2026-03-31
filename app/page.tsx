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

const TAX_RATE = 5;

function calcWht(thbAmount: number): number {
  return (thbAmount * TAX_RATE) / (100 - TAX_RATE);
}

function newRecord(): ChargeRecord {
  return {
    id: crypto.randomUUID(),
    serviceName: '',
    serviceType: 'ค่าบริการ',
    chargeType: 'foreign',
    thbAmount: 0,
    usdAmount: undefined,
    exchangeRate: undefined,
  };
}

export default function Home() {
  const [records, setRecords] = useState<ChargeRecord[]>([newRecord()]);
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
        body: JSON.stringify(records),
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

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">ใบจ่ายเงิน / Payment Voucher</h1>
        <p className="text-sm text-gray-500 mb-6">
          บริษัท ไทยวาโก้ จำกัด (มหาชน) — E-Business &amp; Digital Media
        </p>

        {/* Records table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-6">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Service Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type / รายการ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Charge Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">THB Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">USD</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rate</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">WHT (5/95)</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => {
                const wht = calcWht(r.thbAmount);
                return (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="e.g. CLAUDE.AI"
                        value={r.serviceName}
                        onChange={(e) => update(r.id, { serviceName: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="e.g. ค่าบริการ"
                        value={r.serviceType}
                        onChange={(e) => update(r.id, { serviceType: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        value={r.chargeType}
                        onChange={(e) =>
                          update(r.id, { chargeType: e.target.value as 'foreign' | 'domestic' })
                        }
                      >
                        <option value="foreign">Foreign (USD)</option>
                        <option value="domestic">Domestic (THB)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-28 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="0.00"
                        value={r.thbAmount || ''}
                        onChange={(e) => update(r.id, { thbAmount: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {r.chargeType === 'foreign' && (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-20 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="20"
                          value={r.usdAmount ?? ''}
                          onChange={(e) =>
                            update(r.id, {
                              usdAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.chargeType === 'foreign' && (
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          className="w-24 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="653.87"
                          value={r.exchangeRate ?? ''}
                          onChange={(e) =>
                            update(r.id, {
                              exchangeRate: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      {r.thbAmount > 0 ? wht.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeRecord(r.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          onClick={addRecord}
          className="mb-8 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          + เพิ่มรายการ
        </button>

        {/* Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">เอกสารที่จะสร้าง</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            {docOrder.map((key) => {
              const count = records.filter((r) => CHARGE_DOCS[r.chargeType].includes(key)).length;
              return (
                <div key={key} className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
                  <div className="text-sm font-medium text-blue-800">{DOC_LABELS[key]}</div>
                  <div className="text-xs text-blue-500">{count} รายการ</div>
                </div>
              );
            })}
          </div>
          <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">รวม Credit (THB): </span>
              <span className="font-mono font-semibold">
                {records.reduce((s, r) => s + r.thbAmount, 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">รวม WHT Debit (5/95): </span>
              <span className="font-mono font-semibold">
                {records.reduce((s, r) => s + calcWht(r.thbAmount), 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          {loading ? 'กำลังสร้าง PDF...' : 'Generate PDF'}
        </button>
      </div>
    </main>
  );
}
