import { z } from "zod";

import type { Paciente } from "@/lib/queries/pacientes";

export const pacienteCadastroSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cpf: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  email: z.string().email("E-mail inválido").nullable().optional().or(z.literal("")),
  tipo: z.enum(["particular", "judicial", "convenio", "puc"] as const),
  regimeCobranca: z.enum(["mensalista", "por_sessao"] as const),
  valorMensal: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || /^\d+([.,]\d{1,2})?$/.test(v), "Valor inválido"),
  valorSessao: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || /^\d+([.,]\d{1,2})?$/.test(v), "Valor inválido"),
  modeloRelatorio: z
    .enum(["convencional", "unimed", "sharepoint", "puc"] as const)
    .nullable()
    .optional(),
  convenioId: z.string().nullable().optional(),
  numeroProcesso: z.string().nullable().optional(),
  frequenciaAtendimento: z.string().nullable().optional(),
  diasSemana: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  motivoAcompanhamento: z.string().nullable().optional(),
  modoEmissaoNf: z
    .enum(["automatico_pagamento", "data_especifica"] as const)
    .default("automatico_pagamento"),
  diaEmissaoNf: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 28),
      "Dia entre 1 e 28",
    ),
  modoEmissaoBoleto: z
    .enum(["automatico_pagamento", "data_especifica"] as const)
    .default("automatico_pagamento"),
  diaEmissaoBoleto: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 28),
      "Dia entre 1 e 28",
    ),
  ativo: z.boolean(),
  endereco: z.string().nullable().optional(),
  numeroEndereco: z.string().nullable().optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  uf: z.string().max(2, "UF com 2 letras").nullable().optional(),
  codigoMunicipioIbge: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || /^\d{7}$/.test(v), "Código IBGE com 7 dígitos"),
});

export type PacienteCadastroFormValues = z.infer<typeof pacienteCadastroSchema>;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function parseValorBr(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function emptyPacienteFormValues(): PacienteCadastroFormValues {
  return {
    nome: "",
    cpf: "",
    telefone: "",
    email: "",
    tipo: "particular",
    regimeCobranca: "mensalista",
    modeloRelatorio: null,
    convenioId: null,
    numeroProcesso: null,
    frequenciaAtendimento: "",
    diasSemana: "",
    observacoes: "",
    motivoAcompanhamento: "",
    modoEmissaoNf: "automatico_pagamento",
    diaEmissaoNf: "",
    modoEmissaoBoleto: "automatico_pagamento",
    diaEmissaoBoleto: "",
    ativo: true,
    endereco: "",
    numeroEndereco: "",
    complemento: "",
    bairro: "",
    cep: "",
    cidade: "",
    uf: "",
    codigoMunicipioIbge: "",
    valorMensal: "",
    valorSessao: "",
  };
}

export function pacienteToFormValues(p: Paciente): PacienteCadastroFormValues {
  return {
    nome: p.nome,
    cpf: p.cpf ?? "",
    telefone: p.telefone ?? "",
    email: p.email ?? "",
    tipo: p.tipo,
    regimeCobranca: p.regimeCobranca,
    modeloRelatorio: p.modeloRelatorio ?? null,
    convenioId: p.convenioId ?? null,
    numeroProcesso: p.numeroProcesso ?? null,
    frequenciaAtendimento: p.frequenciaAtendimento ?? "",
    diasSemana: p.diasSemana ?? "",
    observacoes: p.observacoes ?? "",
    motivoAcompanhamento: p.motivoAcompanhamento ?? "",
    modoEmissaoNf: p.modoEmissaoNf ?? "automatico_pagamento",
    diaEmissaoNf: p.diaEmissaoNf != null ? String(p.diaEmissaoNf) : "",
    modoEmissaoBoleto: p.modoEmissaoBoleto ?? "automatico_pagamento",
    diaEmissaoBoleto: p.diaEmissaoBoleto != null ? String(p.diaEmissaoBoleto) : "",
    ativo: p.ativo,
    endereco: p.endereco ?? "",
    numeroEndereco: p.numeroEndereco ?? "",
    complemento: p.complemento ?? "",
    bairro: p.bairro ?? "",
    cep: p.cep ?? "",
    cidade: p.cidade ?? "",
    uf: p.uf ?? "",
    codigoMunicipioIbge: p.codigoMunicipioIbge != null ? String(p.codigoMunicipioIbge) : "",
    valorMensal: p.valorMensal != null ? String(p.valorMensal).replace(".", ",") : "",
    valorSessao: p.valorSessao != null ? String(p.valorSessao).replace(".", ",") : "",
  };
}

export function buildPacientePayload(vals: PacienteCadastroFormValues) {
  return {
    nome: vals.nome,
    cpf: vals.cpf || null,
    telefone: vals.telefone || null,
    email: vals.email || null,
    tipo: vals.tipo,
    regimeCobranca: vals.regimeCobranca,
    modeloRelatorio: vals.modeloRelatorio ?? null,
    convenioId: vals.convenioId || null,
    numeroProcesso: vals.numeroProcesso || null,
    frequenciaAtendimento: vals.frequenciaAtendimento?.trim() || null,
    diasSemana: vals.diasSemana?.trim() || null,
    observacoes: vals.observacoes || null,
    motivoAcompanhamento: vals.motivoAcompanhamento?.trim() || null,
    modoEmissaoNf: vals.modoEmissaoNf,
    diaEmissaoNf: vals.modoEmissaoNf === "data_especifica" ? parseValorBr(vals.diaEmissaoNf) : null,
    modoEmissaoBoleto: vals.modoEmissaoBoleto,
    diaEmissaoBoleto:
      vals.modoEmissaoBoleto === "data_especifica" ? parseValorBr(vals.diaEmissaoBoleto) : null,
    ativo: vals.ativo,
    valorMensal: parseValorBr(vals.valorMensal),
    valorSessao: parseValorBr(vals.valorSessao),
    fisioterapeutaId: null,
    advogadoNome: null,
    advogadoEmail: null,
    formaPagamentoPreferida: null,
    endereco: vals.endereco?.trim() || null,
    numeroEndereco: vals.numeroEndereco?.trim() || null,
    complemento: vals.complemento?.trim() || null,
    bairro: vals.bairro?.trim() || null,
    cep: vals.cep?.trim() ? onlyDigits(vals.cep) : null,
    cidade: vals.cidade?.trim() || null,
    uf: vals.uf?.trim().toUpperCase() || null,
    codigoMunicipioIbge: vals.codigoMunicipioIbge?.trim()
      ? Number(vals.codigoMunicipioIbge.trim())
      : null,
  };
}
