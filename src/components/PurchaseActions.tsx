"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PurchaseActions({ orderId, status }: { orderId: number; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const locked = !["Draft", "Ordered"].includes(status);

  async function act(action: "receive" | "cancel") {
    if (!confirm(action === "receive" ? "Receive all remaining items and add them to stock?" : "Cancel this purchase order?")) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/purchases/${orderId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_order_id: orderId, action }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Update failed");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold">Purchase actions</h3>
      {locked ? <p className="muted mt-2">This order is {status} and cannot be changed.</p> : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={pending} onClick={() => void act("receive")} className="btn-primary py-2.5">Receive all into stock</button>
          <button type="button" disabled={pending} onClick={() => void act("cancel")} className="btn-secondary py-2.5 text-red-600">Cancel order</button>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
    </div>
  );
}
