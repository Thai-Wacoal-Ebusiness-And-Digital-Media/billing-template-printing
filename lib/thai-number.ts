const ones = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const tens = ['', 'สิบ', 'ยี่สิบ', 'สามสิบ', 'สี่สิบ', 'ห้าสิบ', 'หกสิบ', 'เจ็ดสิบ', 'แปดสิบ', 'เก้าสิบ'];

function twoDigits(n: number): string {
  if (n === 0) return '';
  const t = Math.floor(n / 10);
  const o = n % 10;
  let result = '';
  if (t === 1) {
    result += 'สิบ';
    if (o === 1) result += 'เอ็ด';
    else if (o > 0) result += ones[o];
  } else {
    result += tens[t];
    if (o > 0) result += ones[o];
  }
  return result;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const remainder = n % 100;
  let result = '';
  if (h > 0) result += ones[h] + 'ร้อย';
  result += twoDigits(remainder);
  return result;
}

function integerToThai(n: number): string {
  if (n === 0) return 'ศูนย์';
  const parts: string[] = [];
  const units = ['', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  // handle millions separately
  const millions = Math.floor(n / 1_000_000);
  const remainder = n % 1_000_000;
  if (millions > 0) {
    parts.push(integerToThai(millions) + 'ล้าน');
  }
  // process remaining up to 999,999
  const chunks = [
    { val: Math.floor(remainder / 100_000), unit: 'แสน' },
    { val: Math.floor((remainder % 100_000) / 10_000), unit: 'หมื่น' },
    { val: Math.floor((remainder % 10_000) / 1_000), unit: 'พัน' },
    { val: Math.floor((remainder % 1_000) / 100), unit: 'ร้อย' },
    { val: Math.floor((remainder % 100) / 10), unit: 'สิบ' },
    { val: remainder % 10, unit: '' },
  ];

  let str = '';
  for (let i = 0; i < chunks.length; i++) {
    const { val, unit } = chunks[i];
    if (val === 0) continue;
    if (unit === 'สิบ') {
      if (val === 1) str += 'สิบ';
      else if (val === 2) str += 'ยี่สิบ';
      else str += ones[val] + 'สิบ';
    } else if (unit === '') {
      // ones place
      if (val === 1 && str.endsWith('สิบ')) str += 'เอ็ด';
      else str += ones[val];
    } else {
      str += ones[val] + unit;
    }
  }
  parts.push(str);
  return parts.join('');
}

export function toThaiText(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const baht = Math.floor(rounded);
  const satangRaw = Math.round((rounded - baht) * 100);
  const satang = Math.min(satangRaw, 99);

  let result = integerToThai(baht) + 'บาท';
  if (satang > 0) {
    result += twoDigits(satang) + 'สตางค์';
  } else {
    result += 'ถ้วน';
  }
  return result;
}
