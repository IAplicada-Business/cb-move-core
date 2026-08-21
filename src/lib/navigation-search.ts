import { z } from "zod";

export const pacienteTabSchema = z.enum(["dados", "comparecimento", "financeiro"]);
export type PacienteTab = z.infer<typeof pacienteTabSchema>;

export const agendaVisaoSchema = z.enum(["semana", "dia", "mes", "frequencia", "divergencias"]);
export type AgendaVisao = z.infer<typeof agendaVisaoSchema>;

export const relatoriosTabSchema = z.enum(["gerar", "historico"]);
export type RelatoriosTab = z.infer<typeof relatoriosTabSchema>;

export function resolvePacienteTab(tab: PacienteTab | undefined): PacienteTab {
  return tab ?? "dados";
}

export function resolveAgendaVisao(visao: AgendaVisao | undefined): AgendaVisao {
  return visao ?? "semana";
}

export function resolveRelatoriosTab(tab: RelatoriosTab | undefined): RelatoriosTab {
  return tab ?? "gerar";
}
