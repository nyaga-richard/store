/**
 * All prices in PostgreSQL are decimal(10,2) and arrive as strings.
 * We do every calculation in integer cents — no floating point ever touches
 * subtotals, discounts or totals. Max decimal(10,2) = 9_999_999_999 cents,
 * comfortably inside Number.MAX_SAFE_INTEGER.
 */
export function toCents(value: string | number | { toString(): string }): number {
  const text = value.toString().trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`Invalid money value: ${text}`);
  const cents = Number(match[2]) * 100 + Number((match[3] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error(`Money value out of range: ${text}`);
  return match[1] === "-" ? -cents : cents;
}

/** Integer cents -> decimal string for a parameterized numeric column. */
export function toDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Money overflow");
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const formatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
});

export function formatMoney(cents: number): string {
  return formatter.format(cents / 100);
}

/** Percentage discount in basis points-safe integer math (value is 0..100). */
export function percentageDiscount(cents: number, percent: string): number {
  const p = toCents(percent); // e.g. 12.50% -> 1250
  return Math.round((cents * p) / 10_000);
}
