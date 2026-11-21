"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const options = [
  { id: 2, label: "Placed" },
  { id: 4, label: "Shipped" },
  { id: 5, label: "Delivered" },
  { id: 6, label: "Cancelled (restocks items)" },
];

export function OrderStatusForm({ orderId, currentStatusId }: { orderId: number; currentStatusId: number }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatusId === 6 ? 6 : currentStatusId === 3 ? 4 : currentStatusId);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_status_id: Number(status) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Update failed");
      setMessage("Order status updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  const locked = currentStatusId === 6;

  return (
    <form onSubmit={submit} className="card p-5">
      <h3 className="font-semibold">Update order status</h3>
      <p className="muted mt-1">Paid is set only by a confirmed payment. Cancelling returns stock to inventory.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <select className="input max-w-xs" value={status} disabled={locked} onChange={(e) => setStatus(Number(e.target.value))}>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <button type="submit" disabled={pending || locked} className="btn-primary py-2.5">{pending ? "Saving..." : "Apply status"}</button>
      </div>
      {locked && <p className="muted mt-2">This order is cancelled and cannot be reactivated.</p>}
      {message && <p className="mt-2 text-sm text-brand-700">{message}</p>}
    </form>
  );
}
