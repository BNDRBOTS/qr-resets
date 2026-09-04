import { NextResponse } from "next/server";
import { requireSameOriginMutation } from "@/lib/request-origin";

// QR Resets is a prototype preview in this release. The public form is
// deliberately non-operational and must not persist, transmit, or queue
// request data. Keep this hard server-side guard even if the client changes.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const originBlocked = requireSameOriginMutation(req);
  if (originBlocked) return originBlocked;
  return NextResponse.json(
    {
      ok: false,
      demoOnly: true,
      error: "QR Resets is a prototype preview. Requests are not being accepted or stored.",
    },
    { status: 503 },
  );
}
