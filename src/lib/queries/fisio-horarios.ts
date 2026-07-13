import { supabase } from "@/integrations/supabase/client";

export type FisioDisponibilidade = {
  id: string;
  fisioterapeuta_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
};

export type FisioIndisponibilidade = {
  id: string;
  fisioterapeuta_id: string;
  inicio: string;
  fim: string;
  motivo: "ferias" | "intervalo" | "outro";
  observacoes: string | null;
};

export const MOTIVO_INDISP_LABEL: Record<FisioIndisponibilidade["motivo"], string> = {
  ferias: "Férias",
  intervalo: "Intervalo",
  outro: "Outro",
};

function db() {
  return supabase as any;
}

export async function fetchFisioDisponibilidade(
  fisioterapeutaId?: string,
): Promise<FisioDisponibilidade[]> {
  let q = db()
    .from("fisio_disponibilidade")
    .select("id, fisioterapeuta_id, dia_semana, hora_inicio, hora_fim, ativo")
    .eq("ativo", true)
    .order("dia_semana")
    .order("hora_inicio");
  if (fisioterapeutaId) q = q.eq("fisioterapeuta_id", fisioterapeutaId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FisioDisponibilidade[];
}

export async function upsertFisioDisponibilidade(input: {
  id?: string;
  fisioterapeuta_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo?: boolean;
}): Promise<void> {
  const row = {
    fisioterapeuta_id: input.fisioterapeuta_id,
    dia_semana: input.dia_semana,
    hora_inicio: input.hora_inicio,
    hora_fim: input.hora_fim,
    ativo: input.ativo ?? true,
  };
  if (input.id) {
    const { error } = await db().from("fisio_disponibilidade").update(row).eq("id", input.id);
    if (error) throw error;
    return;
  }
  const { error } = await db().from("fisio_disponibilidade").insert(row);
  if (error) throw error;
}

export async function deleteFisioDisponibilidade(id: string): Promise<void> {
  const { error } = await db().from("fisio_disponibilidade").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchFisioIndisponibilidade(opts: {
  inicio: string;
  fim: string;
  fisioterapeutaId?: string;
}): Promise<FisioIndisponibilidade[]> {
  let q = db()
    .from("fisio_indisponibilidade")
    .select("id, fisioterapeuta_id, inicio, fim, motivo, observacoes")
    .lt("inicio", opts.fim)
    .gt("fim", opts.inicio)
    .order("inicio");
  if (opts.fisioterapeutaId) q = q.eq("fisioterapeuta_id", opts.fisioterapeutaId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FisioIndisponibilidade[];
}

export async function createFisioIndisponibilidade(input: {
  fisioterapeuta_id: string;
  inicio: string;
  fim: string;
  motivo: FisioIndisponibilidade["motivo"];
  observacoes?: string | null;
}): Promise<void> {
  const { error } = await db().from("fisio_indisponibilidade").insert({
    fisioterapeuta_id: input.fisioterapeuta_id,
    inicio: input.inicio,
    fim: input.fim,
    motivo: input.motivo,
    observacoes: input.observacoes ?? null,
  });
  if (error) throw error;
}

export async function deleteFisioIndisponibilidade(id: string): Promise<void> {
  const { error } = await db().from("fisio_indisponibilidade").delete().eq("id", id);
  if (error) throw error;
}

/** Indisponibilidade que cobre o slot horário (hora cheia) em um dia. */
export function indisponibilidadeNoSlot(
  items: FisioIndisponibilidade[],
  day: Date,
  hour: number,
  fisioterapeutaId?: string,
): FisioIndisponibilidade | undefined {
  const slotStart = new Date(day);
  slotStart.setHours(hour, 0, 0, 0);
  const slotEnd = new Date(day);
  slotEnd.setHours(hour + 1, 0, 0, 0);
  return items.find((item) => {
    if (fisioterapeutaId && item.fisioterapeuta_id !== fisioterapeutaId) return false;
    const inicio = new Date(item.inicio);
    const fim = new Date(item.fim);
    return inicio < slotEnd && fim > slotStart;
  });
}
