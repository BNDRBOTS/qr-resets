#!/usr/bin/env node

/**
 * Runtime configuration sanity gate.
 * Default Railway backend is SQLite on an attached volume. PostgreSQL/Supabase
 * is opt-in. Runtime secrets may be generated/persisted by start-production.
 */
import { storageBackend, railwayPersistenceReady } from "./storage-backend.mjs";

const failures = [];
let backend = "sqlite";
try {
  backend = storageBackend(process.env);
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

const adminEmail = process.env.ADMIN_EMAIL?.trim() || "";
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim() || "";
const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "";

if (!adminEmail) failures.push("ADMIN_EMAIL is required for the single-admin tools");
if (!adminPasswordHash && !adminPassword) failures.push("ADMIN_PASSWORD or ADMIN_PASSWORD_HASH is required for the single-admin tools");
if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) failures.push("ADMIN_EMAIL must be a valid email address");
if (adminPasswordHash && !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(adminPasswordHash)) failures.push("ADMIN_PASSWORD_HASH must be a bcrypt hash");
if (adminPassword && adminPassword.length < 12) failures.push("ADMIN_PASSWORD should be at least 12 characters");

if (backend === "postgres") {
  const databaseUrl = process.env.DATABASE_URL?.trim() || "";
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) failures.push("STORAGE_BACKEND=postgres requires a PostgreSQL DATABASE_URL");
} else if (!railwayPersistenceReady(process.env)) {
  failures.push("Railway SQLite mode requires an attached persistent volume (recommended mount: /data)");
}

if (process.env.NEXTAUTH_URL) {
  try {
    const parsed = new URL(process.env.NEXTAUTH_URL);
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") failures.push("NEXTAUTH_URL must use https in production");
  } catch {
    failures.push("NEXTAUTH_URL must be a valid absolute URL");
  }
}

if (failures.length) {
  console.error(`Runtime environment verification FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const paymentLinks = [
  "NEXT_PUBLIC_QR_DONATE_MONTHLY_URL",
  "NEXT_PUBLIC_QR_DONATE_ANNUAL_URL",
  "NEXT_PUBLIC_QR_DONATE_CUSTOM_URL",
  "NEXT_PUBLIC_QR_DONATE_SPONSOR_URL",
];
const configuredPaymentLinks = paymentLinks.filter((name) => process.env[name]?.trim()).length;
console.log(`Runtime environment verification PASS (backend=${backend})`);
console.log(`QR donation links configured: ${configuredPaymentLinks}/${paymentLinks.length}`);
console.log(`Stripe webhook configured: ${process.env.STRIPE_WEBHOOK_SECRET?.trim() ? "yes" : "no"}`);
