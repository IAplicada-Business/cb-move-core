export type AppRole = "admin" | "membro" | "cliente" | "gestao" | "recepcao" | "fisio" | "paciente";
export type PacienteTipo = "particular" | "judicial" | "convenio" | "puc";
export type RegimeCobranca = "mensalista" | "por_sessao";
export type FormaPagamento =
  "boleto" | "deposito" | "transferencia" | "alvara_judicial" | "convenio_direto";
export type CobrancaStatus =
  | "pendente"
  | "pago"
  | "atrasado"
  | "cancelado"
  | "vencido"
  | "aguardando_convenio"
  | "aguardando_alvara"
  | "regularizar_retroativa";
export type NfStatus =
  "pendente" | "processando" | "emitida" | "cancelada" | "erro" | "regularizada_retroativa";
export type StatusAgendamento =
  | "agendado"
  | "confirmado"
  | "realizado"
  | "faltou"
  | "cancelado"
  | "remarcacao"
  | "indisponivel"
  | "ferias"
  | "horario_extra";
export type FrequenciaSigla = "P" | "F" | "FJ" | "NJ" | "RC" | "NR";
export type ModeloRelatorio = "convencional" | "unimed" | "sharepoint" | "puc";
export type ModoEmissaoAgendada = "automatico_pagamento" | "data_especifica";
export type ModoEmissaoNf = ModoEmissaoAgendada;
export type ModoEmissaoBoleto = ModoEmissaoAgendada;
export type PeriodizacaoStatus = "planejada" | "em_andamento" | "concluida" | "cancelada";
