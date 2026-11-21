"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { ProductOption, ProductVariantView } from "@/lib/types";

interface Props {
  productName: string;
  options: ProductOption[];
  variants: ProductVariantView[];
}

export function AddToCartForm({ productName, options, variants }: Props) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<number, number>>(() => {
    const first = variants[0];
    return Object.fromEntries((first?.selections ?? []).map((selection) => [selection.optionId, selection.valueId]));
  });
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const selectedVariant = useMemo(() => {
    if (variants.length === 1) return variants[0];
    return variants.find((variant) =>
      Object.entries(selections).length === variant.selections.length &&
      variant.selections.every((selection) => selections[selection.optionId] === selection.valueId),
    );
  }, [selections, variants]);

  const maxQuantity = Math.max(1, Math.min(99, selectedVariant?.qty_in_stock ?? 0));

  async function add(buyNow = false) {
    if (!selectedVariant) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: selectedVariant.variant_id, quantity }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Could not add to cart");
      router.refresh();
      if (buyNow) router.push("/checkout");
      else setMessage({ kind: "ok", text: "Added to your cart." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong" });
    } finally {
      setPending(false);
    }
  }

  if (!variants.length) return <p className="muted">This product is currently unavailable.</p>;

  return (
    <div>
      {options.map((option) => (
        <div key={option.option_id} className="mb-5">
          <p className="mb-2 text-sm font-semibold">{option.option_name}</p>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const active = selections[option.option_id] === value.option_value_id;
              const inStock = variants.some((variant) =>
                variant.selections.some((s) => s.optionId === option.option_id && s.valueId === value.option_value_id) && variant.qty_in_stock > 0);
              return (
                <button key={value.option_value_id} type="button" onClick={() => setSelections((prev) => ({ ...prev, [option.option_id]: value.option_value_id }))}
                  className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${active ? "border-brand-700 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-700 hover:border-brand-500"} ${!inStock ? "opacity-50" : ""}`}>
                  {value.value_name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-6 flex items-center gap-4">
        <div className="flex items-center rounded-xl border border-slate-300">
          <button type="button" className="px-3 py-2 text-lg text-slate-500" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
          <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
          <button type="button" className="px-3 py-2 text-lg text-slate-500" onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} aria-label="Increase quantity">+</button>
        </div>
        <p className="muted">
          {selectedVariant?.qty_in_stock ? `${selectedVariant.qty_in_stock} in stock` : "Out of stock"}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn-primary flex-1" disabled={pending || !selectedVariant || selectedVariant.qty_in_stock < 1} onClick={() => add(false)}>
          {pending ? "Adding..." : selectedVariant?.qty_in_stock ? "Add to cart" : "Out of stock"}
        </button>
        <button type="button" className="btn-secondary" disabled={pending || !selectedVariant || selectedVariant.qty_in_stock < 1} onClick={() => add(true)}>
          Buy now
        </button>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${message.kind === "ok" ? "text-brand-700" : "text-red-600"}`}>
          {message.kind === "ok" && <Link href="/cart" className="underline">View cart →</Link>} {message.text}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-400">SKU: {selectedVariant?.sku ?? "—"} · {productName}</p>
    </div>
  );
}

export function DisplayPrice({ cents, size = "text-3xl" }: { cents: number; size?: string }) {
  return <span className={`${size} font-bold text-slate-900`}>{formatMoney(cents)}</span>;
}
