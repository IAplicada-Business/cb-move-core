import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ClickSignSignerInput = {
  email: string;
  name: string;
};

export function clicksignBaseUrl(): string {
  return Deno.env.get("CLICKSIGN_BASE_URL") ?? "https://app.clicksign.com/api/v1";
}

export function clicksignToken(): string | null {
  const token = Deno.env.get("CLICKSIGN_TOKEN");
  return token?.trim() ? token.trim() : null;
}

export function clicksignAdminEmail(): string {
  return Deno.env.get("CLICKSIGN_ADMIN_SIGNER_EMAIL")?.trim() || "cbmoveneuro@gmail.com";
}

export async function clicksignFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = clicksignToken();
  if (!token) throw new Error("CLICKSIGN_TOKEN não configurado");

  const base = clicksignBaseUrl().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, { ...init, headers });
}

export async function clicksignCreateSigner(input: ClickSignSignerInput): Promise<string> {
  const res = await clicksignFetch("/signers", {
    method: "POST",
    body: JSON.stringify({
      signer: {
        email: input.email,
        name: input.name,
        auths: ["email"],
        has_documentation: false,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ClickSign signatário: ${res.status} — ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const key = data?.signer?.key;
  if (!key) throw new Error("ClickSign não retornou signer key");
  return key as string;
}

export async function clicksignAddSignerToDocument(input: {
  documentKey: string;
  signerKey: string;
  message?: string;
  group?: number;
}): Promise<{ url: string | null; requestSignatureKey: string | null }> {
  const res = await clicksignFetch("/lists", {
    method: "POST",
    body: JSON.stringify({
      list: {
        document_key: input.documentKey,
        signer_key: input.signerKey,
        sign_as: "sign",
        refusable: false,
        group: input.group ?? 1,
        message:
          input.message ??
          "Prezado(a),\nPor favor assine o relatório mensal de atendimento.\n\nAtenciosamente,\nCB MOVE",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ClickSign list: ${res.status} — ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    url: data?.list?.url ?? null,
    requestSignatureKey: data?.list?.request_signature_key ?? null,
  };
}

export async function clicksignGetDocument(documentKey: string): Promise<Record<string, unknown>> {
  const res = await clicksignFetch(`/documents/${documentKey}`, { method: "GET" });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ClickSign document: ${res.status} — ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.document ?? data) as Record<string, unknown>;
}

export function extractSignedPdfUrl(doc: Record<string, unknown>): string | null {
  const downloads = doc.downloads as Record<string, unknown> | undefined;
  const candidates = [downloads?.signed_file_url, downloads?.signed_file, doc.signed_file_url];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  return null;
}

export async function verifyClickSignWebhook(req: Request): Promise<boolean> {
  const secret =
    Deno.env.get("CLICKSIGN_WEBHOOK_SECRET")?.trim() ||
    Deno.env.get("CLICKSIGN_HMAC_SECRET")?.trim();
  if (!secret) return false;

  const rawBody = await req.clone().text();
  const header =
    req.headers.get("x-clicksign-signature") ??
    req.headers.get("Content-Hmac") ??
    req.headers.get("content-hmac");

  if (!header) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const normalized = header.startsWith("sha256=") ? header : `sha256=${header}`;
  const expected = `sha256=${hex}`;

  return timingSafeEqual(normalized, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function getIntegracaoConfigValue(
  admin: SupabaseClient,
  key: string,
): Promise<string | null> {
  const { data } = await admin
    .from("integracao_config")
    .select("valor")
    .eq("chave", key)
    .maybeSingle();
  const v = data?.valor;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
