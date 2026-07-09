import { supabase } from "@/integrations/supabase/client";

type EdgeErrorBody = { error?: string };

function extractEdgeErrorMessage(
  error: { message: string } | null,
  data: unknown,
): string | null {
  if (data && typeof data === "object" && data !== null) {
    const msg = (data as EdgeErrorBody).error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return error?.message ?? null;
}

export async function invokeEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  const message = extractEdgeErrorMessage(error, data);
  if (message) throw new Error(message);
  return data as T;
}
