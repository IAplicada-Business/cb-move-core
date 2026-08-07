import { z } from "zod";

export const prontuarioTabSchema = z.enum([
  "visao-geral",
  "evolucao-diaria",
  "avaliacoes",
  "documentos",
  "periodizacao",
  "historico",
]);

export const prontuarioPatientTabSchema = z.enum([
  "evolucao-diaria",
  "avaliacoes",
  "documentos",
  "periodizacao",
  "historico",
]);

export type ProntuarioTab = z.infer<typeof prontuarioTabSchema>;
export type ProntuarioPatientTab = z.infer<typeof prontuarioPatientTabSchema>;

export function resolvePatientTab(tab: ProntuarioPatientTab | undefined): ProntuarioPatientTab {
  return tab ?? "evolucao-diaria";
}

export const TAB_TRIGGER_CLS =
  "rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 shadow-none data-[state=active]:border-cb-cyan-600 data-[state=active]:text-cb-cyan-800 data-[state=active]:shadow-none text-muted-foreground font-medium";
