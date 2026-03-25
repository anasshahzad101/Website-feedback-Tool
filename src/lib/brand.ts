/** Default product name when env is unset (white-label). */
export const DEFAULT_BRAND_NAME = "Website Feedback Tool";

export function publicBrandName(): string {
  return process.env.NEXT_PUBLIC_BRAND_NAME || DEFAULT_BRAND_NAME;
}

export function publicAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME || publicBrandName();
}
