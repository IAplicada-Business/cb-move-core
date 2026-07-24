import { INTERNAL_TRIGGER_HEADER } from "./auth.ts";

export async function triggerSendBoletoCobranca(
  supabaseUrl: string,
  serviceKey: string,
  cobrancaId: string,
  origin = "internal",
): Promise<{ ok: boolean; erro: string | null; queued?: boolean }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-boleto-cobranca`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        [INTERNAL_TRIGGER_HEADER]: origin,
      },
      body: JSON.stringify({
        cobranca_id: cobrancaId,
        event_id: `boleto-cron-${cobrancaId}`,
      }),
    });
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      const detail = typeof body?.error === "string" ? body.error : JSON.stringify(body).slice(0, 300);
      return { ok: false, erro: `send-boleto-cobranca retornou ${res.status}: ${detail}` };
    }
    return {
      ok: true,
      erro: null,
      queued: Boolean(body?.queued),
    };
  } catch (err) {
    return {
      ok: false,
      erro: `send-boleto-cobranca: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
