import { db } from "@/lib/db/client";
import { DEFAULT_BRAND_NAME } from "@/lib/brand";

const SETTINGS_ID = "default";

export type PublicBranding = {
  brandName: string;
  appName: string;
  logoUrl: string | null;
  tagline: string | null;
};

function envBrandName(): string {
  return process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || DEFAULT_BRAND_NAME;
}

function envAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || envBrandName();
}

/** Merge DB row with env fallbacks (stored values win when non-empty). */
export function mergeBrandingFromRow(row: {
  brandName: string;
  appName: string;
  logoPath: string | null;
  tagline: string | null;
}): PublicBranding {
  const eb = envBrandName();
  const ea = envAppName();
  const brandName = row.brandName?.trim() || eb;
  const appName = row.appName?.trim() || ea;
  const p = row.logoPath?.trim();
  const logoUrl = p
    ? p.startsWith("http")
      ? p
      : p.startsWith("/")
        ? p
        : `/${p}`
    : null;
  return {
    brandName,
    appName,
    logoUrl,
    tagline: row.tagline?.trim() || null,
  };
}

/**
 * Ensures the singleton settings row exists (defaults from env / constants).
 */
export async function getOrCreateAppSettings() {
  let row = await db.appSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!row) {
    row = await db.appSettings.create({
      data: {
        id: SETTINGS_ID,
        brandName: envBrandName(),
        appName: envAppName(),
      },
    });
  }
  return row;
}

export async function getPublicBranding(): Promise<PublicBranding> {
  try {
    const row = await getOrCreateAppSettings();
    return mergeBrandingFromRow(row);
  } catch {
    return {
      brandName: envBrandName(),
      appName: envAppName(),
      logoUrl: null,
      tagline: null,
    };
  }
}

export async function needsInitialSetup(): Promise<boolean> {
  try {
    const n = await db.user.count();
    return n === 0;
  } catch {
    return false;
  }
}
