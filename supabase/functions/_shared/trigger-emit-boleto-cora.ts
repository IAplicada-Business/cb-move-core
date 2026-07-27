import { INTERNAL_TRIGGER_HEADER } from "./auth.ts";

export async function triggerEmitBoletoCora(
  supabaseUrl: string,
  serviceKey: string,
  cobrancaId: string,
  origin = "internal",
): Promise<{ ok: boolean; erro: string | null; boleto_url?: string | null }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/emit-boleto-cora`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        [INTERNAL_TRIGGER_HEADER]: origin,
      },
      body: JSON.stringify({ cobranca_id: cobrancaId }),
    });
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      const detail =
        typeof body?.error === "string" ? body.error : JSON.stringify(body).slice(0, 300);
      return { ok: false, erro: `emit-boleto-cora retornou ${res.status}: ${detail}` };
    }
    return {
      ok: true,
      erro: null,
      boleto_url: typeof body?.boleto_url === "string" ? body.boleto_url : null,
    };
  } catch (err) {
    return {
      ok: false,
      erro: `emit-boleto-cora: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
