"use client";

import Image from "next/image";
import { useState } from "react";

export function ImageGallery({ images, name, fallback }: {
  images: { image_id: number; image_url: string }[];
  name: string;
  fallback: string | null;
}) {
  const all = images.length ? images : fallback ? [{ image_id: 0, image_url: fallback }] : [];
  const [active, setActive] = useState(0);
  if (!all.length) return <div className="img-shell aspect-square rounded-2xl" />;
  const selected = all[Math.min(active, all.length - 1)].image_url;

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <Image src={selected} alt={name} fill priority sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
      </div>
      {all.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {all.map((image, index) => (
            <button key={image.image_id} type="button" onClick={() => setActive(index)}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${index === active ? "border-brand-700" : "border-transparent"}`}>
              <Image src={image.image_url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
