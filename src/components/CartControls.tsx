"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CartControls({ variantId, quantity, stock }: { variantId: number; quantity: number; stock: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function update(next: number) {
    if (next < 0) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: next }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Could not update cart");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center rounded-lg border border-slate-300 text-sm">
        <button type="button" disabled={pending} className="px-2.5 py-1.5" onClick={() => update(quantity - 1)} aria-label="Decrease quantity">−</button>
        <span className="w-7 text-center font-semibold">{quantity}</span>
        <button type="button" disabled={pending || quantity >= Math.min(99, stock)} className="px-2.5 py-1.5" onClick={() => update(quantity + 1)} aria-label="Increase quantity">+</button>
      </div>
      {quantity > stock && <span className="text-xs text-red-600">Only {stock} in stock</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
