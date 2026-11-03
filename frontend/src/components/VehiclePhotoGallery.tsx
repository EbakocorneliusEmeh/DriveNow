"use client";

import Image from "next/image";
import { useState } from "react";

export default function VehiclePhotoGallery({
  imageUrls,
  alt,
  className = "",
}: {
  imageUrls: string[];
  alt: string;
  className?: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedPhoto = imageUrls[selectedIndex] ?? imageUrls[0];

  return (
    <div className={className}>
      <div className="relative flex h-52 items-center justify-center overflow-hidden bg-[#f4f1eb]">
        {selectedPhoto ? (
          <Image src={selectedPhoto} alt={`${alt}, photo ${selectedIndex + 1}`} fill unoptimized className="object-cover" />
        ) : (
          <span className="text-sm text-[#87928c]">No vehicle photo</span>
        )}
        {imageUrls.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
            {selectedIndex + 1} / {imageUrls.length}
          </span>
        )}
      </div>
      {imageUrls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-[#e9e5dc] bg-[#fffdf9] p-3" aria-label={`${alt} photos`}>
          {imageUrls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Show ${alt}, photo ${index + 1}`}
              aria-pressed={selectedIndex === index}
              className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${selectedIndex === index ? "border-[#d9a441]" : "border-transparent"}`}
            >
              <Image src={url} alt="" fill unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
