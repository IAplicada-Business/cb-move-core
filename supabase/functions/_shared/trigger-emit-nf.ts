import { INTERNAL_TRIGGER_HEADER } from "./auth.ts";

type TriggerEmitNfOptions =
  | { mode: "internal"; serviceKey: string; origin: string }
  | { mode: "user"; authorization: string };

export async function triggerEmitNf(
  supabaseUrl: string,
  nfId: string,
  options: TriggerEmitNfOptions,
): Promise<{ ok: boolean; erro: string | null }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: options.mode === "user"
        ? options.authorization
        : `Bearer ${options.serviceKey}`,
    };
    if (options.mode === "internal") {
      headers[INTERNAL_TRIGGER_HEADER] = options.origin;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/emit-nf`, {
      method: "POST",
      headers,
      body: JSON.stringify({ nf_id: nfId }),
    });
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      const detail = typeof body?.error === "string" ? body.error : JSON.stringify(body).slice(0, 300);
      return { ok: false, erro: `emit-nf retornou ${res.status}: ${detail}` };
    }
    return { ok: true, erro: null };
  } catch (err) {
    return {
      ok: false,
      erro: `emit-nf: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
