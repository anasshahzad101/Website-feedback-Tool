"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PublicBranding } from "@/lib/app-settings";

const BrandingContext = createContext<{
  branding: PublicBranding;
  refresh: () => Promise<void>;
} | null>(null);

const DEFAULT_FALLBACK: PublicBranding = {
  brandName: "Website Feedback Tool",
  appName: "Website Feedback Tool",
  logoUrl: null,
  tagline: null,
};

export function BrandingProvider({
  initial,
  children,
}: {
  initial: PublicBranding;
  children: ReactNode;
}) {
  const [branding, setBranding] = useState<PublicBranding>(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/branding");
      if (res.ok) {
        const data = (await res.json()) as PublicBranding;
        setBranding(data);
      }
    } catch {
      /* keep previous */
    }
  }, []);

  const value = useMemo(() => ({ branding, refresh }), [branding, refresh]);

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}

export function useBranding(): PublicBranding & { refresh: () => Promise<void> } {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return { ...DEFAULT_FALLBACK, refresh: async () => {} };
  }
  return { ...ctx.branding, refresh: ctx.refresh };
}
