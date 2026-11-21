import { formatMoney } from "@/lib/money";

export function Price({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={className}>{formatMoney(cents)}</span>;
}
