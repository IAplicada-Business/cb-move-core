import { supabase } from "@/integrations/supabase/client";

type EdgeErrorBody = { error?: string };

export async function extractEdgeErrorMessage(
  error: unknown,
  data: unknown,
): Promise<string | null> {
  if (data && typeof data === "object" && data !== null) {
    const msg = (data as EdgeErrorBody).error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }

  if (error && typeof error === "object" && "context" in error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const cloned = ctx.clone?.() ?? ctx;
        const j = (await cloned.json()) as { error?: string };
        if (j?.error) return j.error;
      } catch {
        /* ignore */
      }
    }
  }

  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message: string }).message;
    if (msg) return msg;
  }

  return null;
}

export async function invokeEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const message = await extractEdgeErrorMessage(error, data);
  if (message) throw new Error(message);
  return data as T;
}
