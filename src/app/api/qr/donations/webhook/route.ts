import { NextResponse } from "next/server";

// QR Resets is a prototype preview in this release. Donation processing is
// deliberately disabled. This route performs no signature processing, payment
// handling, or database mutation.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      received: false,
      demoOnly: true,
      error: "QR Resets is not accepting or processing donations in this release.",
    },
    { status: 503 },
  );
}
