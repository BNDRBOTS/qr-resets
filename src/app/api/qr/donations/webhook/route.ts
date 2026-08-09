import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOLERANCE_SECONDS = 300;
const MAX_WEBHOOK_BYTES = 1024 * 1024;

function validStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some((sig) => {
    try {
      const actual = Buffer.from(sig, "hex");
      return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
    } catch {
      return false;
    }
  });
}


async function readBoundedText(req: Request, maxBytes: number) {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // Ignore cancellation failures; the request is already rejected.
      }
      throw new Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(output);
}

type StripeLikeEvent = {
  id?: string;
  type?: string;
  created?: number;
  data?: { object?: Record<string, unknown> };
};

function stringMetadata(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .slice(0, 50);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature || signature.length > 8192) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let payload: string;
  try {
    payload = await readBoundedText(req, MAX_WEBHOOK_BYTES);
  } catch {
    return NextResponse.json({ error: "Webhook payload too large." }, { status: 413 });
  }

  if (!validStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeLikeEvent;
  try {
    event = JSON.parse(payload) as StripeLikeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  if (!event.id || !event.type || !event.created) return NextResponse.json({ error: "Incomplete event." }, { status: 400 });

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const object = event.data?.object ?? {};
    const amount = typeof object.amount_total === "number" ? object.amount_total : 0;
    const currency = typeof object.currency === "string" ? object.currency : "usd";
    const mode = typeof object.mode === "string" ? object.mode : "payment";
    const status = typeof object.payment_status === "string" ? object.payment_status : event.type;
    const checkoutId = typeof object.id === "string" ? object.id : null;
    const metadata = stringMetadata(object.metadata);

    await db.qrDonationEvent.upsert({
      where: { processorEventId: event.id },
      update: { status },
      create: {
        processorEventId: event.id,
        checkoutId,
        amountCents: Math.max(0, Math.trunc(amount)),
        currency,
        recurring: mode === "subscription",
        status,
        metadata,
        occurredAt: new Date(event.created * 1000),
      },
    });
  }

  return NextResponse.json({ received: true });
}
