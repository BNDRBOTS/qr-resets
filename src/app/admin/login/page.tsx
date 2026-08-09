import { AdminLoginForm } from "@/components/bndr/admin-login-form";

export const dynamic = "force-dynamic";

function safeCallbackUrl(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate.startsWith("//") || candidate.includes("\\")) {
    return "/admin";
  }
  try {
    const parsed = new URL(candidate, "https://bndr.invalid");
    if (parsed.origin !== "https://bndr.invalid") return "/admin";
    if (parsed.pathname !== "/admin" && !parsed.pathname.startsWith("/admin/")) {
      return "/admin";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/admin";
  }
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  return (
    <AdminLoginForm
      callbackUrl={safeCallbackUrl(params.callbackUrl)}
      hasError={Boolean(params.error)}
    />
  );
}
