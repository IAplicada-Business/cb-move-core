import { supabase } from "@/integrations/supabase/client";

export type SessaoFisioLink = {
  sessaoId: string;
  fisioterapeutaId: string;
  principal: boolean;
  fisioNome?: string;
};

export async function fetchSessaoFisioterapeutas(sessaoId: string): Promise<SessaoFisioLink[]> {
  const { data, error } = await supabase
    .from("sessao_fisioterapeutas")
    .select("sessao_id, fisioterapeuta_id, principal, fisioterapeutas(nome)")
    .eq("sessao_id", sessaoId);
  if (error) throw error;

  return (data ?? []).map((row: {
    sessao_id: string;
    fisioterapeuta_id: string;
    principal: boolean;
    fisioterapeutas?: { nome: string } | null;
  }) => ({
    sessaoId: row.sessao_id,
    fisioterapeutaId: row.fisioterapeuta_id,
    principal: row.principal,
    fisioNome: row.fisioterapeutas?.nome,
  }));
}

/** Define todos os fisios de uma sessão; o primeiro da lista é o principal. */
export async function setSessaoFisioterapeutas(
  sessaoId: string,
  fisioterapeutaIds: string[],
): Promise<void> {
  const unique = [...new Set(fisioterapeutaIds.filter(Boolean))];
  if (unique.length === 0) return;

  const principalId = unique[0];

  const { error: updError } = await supabase
    .from("sessoes")
    .update({ fisioterapeuta_id: principalId })
    .eq("id", sessaoId);
  if (updError) throw updError;

  const { error: delError } = await supabase
    .from("sessao_fisioterapeutas")
    .delete()
    .eq("sessao_id", sessaoId);
  if (delError) throw delError;

  const rows = unique.map((fisioterapeutaId, idx) => ({
    sessao_id: sessaoId,
    fisioterapeuta_id: fisioterapeutaId,
    principal: idx === 0,
  }));

  const { error: insError } = await supabase.from("sessao_fisioterapeutas").insert(rows);
  if (insError) throw insError;
}

export async function syncSessaoFisioterapeutasExtras(
  sessaoId: string,
  principalId: string | null,
  extraIds: string[],
): Promise<void> {
  const all = principalId
    ? [principalId, ...extraIds.filter((id) => id !== principalId)]
    : extraIds;
  await setSessaoFisioterapeutas(sessaoId, all);
}
