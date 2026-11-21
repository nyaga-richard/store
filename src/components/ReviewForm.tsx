"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewForm({ orderLineId }: { orderLineId: number }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_line_id: orderLineId, rating, comment }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Could not submit review");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (done) return <p className="text-sm font-medium text-brand-700">Thank you for your review!</p>;

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} stars`}
            className={`text-xl ${value <= rating ? "text-accent" : "text-slate-300"}`}>★</button>
        ))}
      </div>
      <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={2}
        className="input" placeholder="Tell others what you think (optional)" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="btn-secondary w-full py-2 text-xs">{pending ? "Submitting..." : "Submit review"}</button>
    </form>
  );
}
