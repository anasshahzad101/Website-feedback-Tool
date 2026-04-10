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
    <div
      className={cn(
        "relative inline-block max-w-full align-top",
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          "block max-w-full h-auto align-top",
          // No object-contain: wrapper hugs image pixels so the pin marker aligns and there’s no empty bars.
          imgClassName
        )}
      />
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
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
            className="flex min-h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-sm font-bold text-white shadow-lg ring-[3px] ring-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
            style={{ backgroundColor: pinColor }}
          >
            {pinNumber}
          </span>
        </div>
      </div>
    </div>
  );
}
