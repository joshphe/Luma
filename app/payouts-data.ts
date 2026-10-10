const usd = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const DAY_MS = 86_400_000;

export type PayoutRecord = { cents: number; amount: string; date: string };
export type Payouts = { total: string; latestDate: string; records: PayoutRecord[] };

export function parseUsdCents(value: string): number {
  const trimmed = value.trim();
  // Accept plain numbers or correctly grouped US thousands, with at most two decimals.
  if (!/^(?:\d{1,12}|\d{1,3}(?:,\d{3}){1,3})(?:\.\d{0,2})?$/.test(trimmed)) {
    throw new Error('金额请输入非负数字，最多保留两位小数。');
  }
  const [whole, fraction = ''] = trimmed.replaceAll(',', '').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function formatUsdCents(cents: number): string {
  return usd.format(cents / 100);
}

export function parsePayoutDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('请选择有效的最晚日期。');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('请选择有效的最晚日期。');
  }
  return date;
}

export function createPayouts(amounts: string[], latest: string): Payouts {
  if (amounts.length < 1 || amounts.length > 3) throw new Error('请填写 1–3 条过往金额记录。');
  const latestDate = parsePayoutDate(latest);
  const records = amounts.map((value, index) => {
    const cents = parseUsdCents(value);
    // UTC calendar arithmetic keeps every interval at 14 days across DST and year boundaries.
    const date = new Date(latestDate.getTime() - index * 14 * DAY_MS);
    if (date.getUTCFullYear() < 1) throw new Error('日期过早，无法向前推算全部记录。');
    return { cents, amount: formatUsdCents(cents), date: dateFormat.format(date) };
  });
  return {
    total: formatUsdCents(records.reduce((sum, record) => sum + record.cents, 0)),
    latestDate: dateFormat.format(latestDate), records,
  };
}
