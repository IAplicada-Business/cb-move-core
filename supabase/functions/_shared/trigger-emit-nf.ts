import { INTERNAL_TRIGGER_HEADER } from "./auth.ts";

export async function triggerEmitNf(
  supabaseUrl: string,
  serviceKey: string,
  nfId: string,
  origin = "internal",
): Promise<{ ok: boolean; erro: string | null }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/emit-nf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        [INTERNAL_TRIGGER_HEADER]: origin,
      },
      body: JSON.stringify({ nf_id: nfId }),
    });
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      const detail = typeof body?.error === "string" ? body.error : JSON.stringify(body).slice(0, 300);
      return { ok: false, erro: `emit-nf retornou ${res.status}: ${detail}` };
    }
    return { ok: true, erro: null };
  } catch (err) {
    return { ok: false, erro: `emit-nf: ${err instanceof Error ? err.message : String(err)}` };
  }
}
