import { z } from "zod";

export const prontuarioPatientTabSchema = z.enum([
  "evolucao-diaria",
  "avaliacoes",
  "periodizacao-documentos",
]);

export const prontuarioLegacyPatientTabSchema = z.enum(["documentos", "periodizacao", "historico"]);

export const prontuarioTabSchema = z.union([
  z.enum(["visao-geral"]),
  prontuarioPatientTabSchema,
  prontuarioLegacyPatientTabSchema,
]);

export type ProntuarioTab = z.infer<typeof prontuarioTabSchema>;
export type ProntuarioPatientTab = z.infer<typeof prontuarioPatientTabSchema>;

const LEGACY_TO_UNIFIED: Record<
  z.infer<typeof prontuarioLegacyPatientTabSchema>,
  ProntuarioPatientTab
> = {
  documentos: "periodizacao-documentos",
  periodizacao: "periodizacao-documentos",
  historico: "periodizacao-documentos",
};

export function isLegacyPatientTab(
  tab: string,
): tab is z.infer<typeof prontuarioLegacyPatientTabSchema> {
  return tab === "documentos" || tab === "periodizacao" || tab === "historico";
}

export function normalizePatientTab(tab: string | undefined): ProntuarioPatientTab {
  if (!tab) return "evolucao-diaria";
  if (isLegacyPatientTab(tab)) return LEGACY_TO_UNIFIED[tab];
  const parsed = prontuarioPatientTabSchema.safeParse(tab);
  return parsed.success ? parsed.data : "evolucao-diaria";
}

export function resolvePatientTab(tab: ProntuarioPatientTab | undefined): ProntuarioPatientTab {
  return tab ?? "evolucao-diaria";
}
