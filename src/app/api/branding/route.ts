import { NextResponse } from "next/server";
import { getPublicBranding } from "@/lib/app-settings";

/** Public branding for login, guests, and client UI (no auth). */
export async function GET() {
  try {
    const b = await getPublicBranding();
    return NextResponse.json(b);
  } catch {
    return NextResponse.json(
      {
        brandName: "Website Feedback Tool",
        appName: "Website Feedback Tool",
        logoUrl: null,
        tagline: null,
      },
      { status: 200 }
    );
  }
}
