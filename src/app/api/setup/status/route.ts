import { NextResponse } from "next/server";
import { needsInitialSetup } from "@/lib/app-settings";

export async function GET() {
  try {
    const needsSetup = await needsInitialSetup();
    return NextResponse.json({ needsSetup });
  } catch {
    return NextResponse.json(
      { needsSetup: false, error: "database_unavailable" },
      { status: 503 }
    );
  }
}
