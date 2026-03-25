"use client";

import Image from "next/image";
import { useBranding } from "@/contexts/branding-context";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  boxClassName,
  letterClassName,
}: {
  /** Outer wrapper (e.g. h-9 w-9) */
  className?: string;
  boxClassName?: string;
  letterClassName?: string;
}) {
  const { brandName, logoUrl } = useBranding();
  const letter = brandName?.trim()?.charAt(0)?.toUpperCase() || "W";

  if (logoUrl) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 bg-background",
          className
        )}
      >
        <Image
          src={logoUrl}
          alt=""
          fill
          className={cn("object-contain p-0.5", boxClassName)}
          sizes="40px"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-sm ring-1 ring-white/10",
        className
      )}
    >
      <span
        className={cn("text-lg font-black leading-none", letterClassName)}
      >
        {letter}
      </span>
    </div>
  );
}
