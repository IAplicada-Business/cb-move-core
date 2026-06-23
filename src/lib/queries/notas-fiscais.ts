import { supabase } from "@/integrations/supabase/client";

export async function countNotasMonth(year: number, month: number): Promise<number> {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();
  const { count, error } = await supabase
    .from("notas_fiscais")
    .select("*", { count: "exact", head: true })
    .eq("status", "emitida")
    .gte("emitida_em", start)
    .lt("emitida_em", end);
  if (error) throw error;
  return count ?? 0;
}
