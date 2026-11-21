import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page grid place-items-center py-24 text-center">
      <div>
        <p className="text-6xl font-black text-brand-700">404</p>
        <h1 className="mt-3 text-2xl font-bold">We couldn&apos;t find that page</h1>
        <p className="muted mt-2">The product or page may have moved.</p>
        <Link href="/products" className="btn-primary mt-6">Browse products</Link>
      </div>
    </div>
  );
}
