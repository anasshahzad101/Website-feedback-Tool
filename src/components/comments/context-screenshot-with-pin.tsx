"use client";

import { cn } from "@/lib/utils";

/**
 * Pin-centered context crops place the click at ~50%/50%. Full-page fallbacks
 * can use annotation xPercent/yPercent (0–1) mapped to % of this image.
 */
export function ContextScreenshotWithPin({
  src,
  alt,
  pinNumber,
  pinColor,
  className,
  imgClassName,
  markerLeftPercent = 50,
  markerTopPercent = 50,
}: {
  src: string;
  alt: string;
  pinNumber: number;
  pinColor: string;
  className?: string;
  imgClassName?: string;
  /** 0–100, position of marker horizontally on the image */
  markerLeftPercent?: number;
  /** 0–100, position of marker vertically on the image */
  markerTopPercent?: number;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <img
        src={src}
        alt={alt}
        className={cn("w-full h-auto object-contain block", imgClassName)}
      />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: `${markerLeftPercent}%`,
            top: `${markerTopPercent}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <span
            className="flex min-h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold text-white shadow-lg ring-[3px] ring-white/95"
            style={{ backgroundColor: pinColor }}
          >
            {pinNumber}
          </span>
        </div>
      </div>
    </div>
  );
}
