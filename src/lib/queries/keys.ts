export const queryKeys = {
  pacientes: {
    all: ["pacientes"] as const,
    list: (filters?: Record<string, unknown>) => ["pacientes", "list", filters ?? {}] as const,
    byId: (id: string) => ["pacientes", "byId", id] as const,
  },
  cobrancas: {
    all: ["cobrancas"] as const,
    list: (filters?: Record<string, unknown>) => ["cobrancas", "list", filters ?? {}] as const,
    recent: (n: number) => ["cobrancas", "recent", n] as const,
    byMonth: (months: number) => ["cobrancas", "byMonth", months] as const,
    kpis: (year: number, month: number) => ["cobrancas", "kpis", year, month] as const,
  },
  notasFiscais: {
    all: ["notas_fiscais"] as const,
    list: (filters?: Record<string, unknown>) => ["notas_fiscais", "list", filters ?? {}] as const,
    monthCount: (year: number, month: number) => ["notas_fiscais", "monthCount", year, month] as const,
  },
  agendamentos: {
    all: ["agendamentos"] as const,
    semana: (inicio: string) => ["agendamentos", "semana", inicio] as const,
    periodo: (inicio: string, fim: string) => ["agendamentos", "periodo", inicio, fim] as const,
    avisoDia: (data: string) => ["agendamentos", "aviso", data] as const,
  },
  sessoes: {
    all: ["sessoes"] as const,
    mensal: (pacienteId: string, mes: number, ano: number) => ["sessoes", "mensal", pacienteId, mes, ano] as const,
    gradeMes: (mes: number, ano: number) => ["sessoes", "grade", mes, ano] as const,
    comparecimentoMes: (pacienteId: string, mes: number, ano: number) =>
      ["sessoes", "comparecimento", pacienteId, mes, ano] as const,
    comparecimentoHistorico: (pacienteId: string, meses: number) =>
      ["sessoes", "comparecimento", "historico", pacienteId, meses] as const,
    siglaDia: (pacienteId: string, data: string) =>
      ["sessoes", "siglaDia", pacienteId, data] as const,
    planoMensal: (pacienteId: string, mes: number, ano: number) =>
      ["sessoes", "planoMensal", pacienteId, mes, ano] as const,
  },
  relatorios: {
    all: ["relatorios_atendimento"] as const,
    byPaciente: (pacienteId: string) => ["relatorios_atendimento", pacienteId] as const,
  },
  prontuario: {
    search: (q: string) => ["prontuario", "search", q] as const,
    paciente: (id: string) => ["prontuario", "paciente", id] as const,
    sessoes: (id: string) => ["prontuario", "sessoes", id] as const,
    evolucoes: (id: string) => ["prontuario", "evolucoes", id] as const,
    avaliacoes: (id: string) => ["prontuario", "avaliacoes", id] as const,
    relatorios: (id: string) => ["prontuario", "relatorios", id] as const,
    historico: (id: string) => ["prontuario", "historico", id] as const,
  },
  convenios: {
    all: ["convenios"] as const,
  },
  fisioterapeutas: {
    all: ["fisioterapeutas"] as const,
    ativos: ["fisioterapeutas", "ativos"] as const,
    metrics: (fisioId: string) => ["fisioterapeutas", "metrics", fisioId] as const,
  },
  fisioHorarios: {
    all: ["fisio_horarios"] as const,
    disponibilidade: (fisioId?: string) =>
      ["fisio_horarios", "disponibilidade", fisioId ?? "all"] as const,
    indisponibilidade: (inicio: string, fim: string, fisioId?: string) =>
      ["fisio_horarios", "indisponibilidade", inicio, fim, fisioId ?? "all"] as const,
  },
  usuarios: {
    all: ["usuarios"] as const,
    menuPermissions: (role: string) => ["usuarios", "menu-permissions", role] as const,
    menuAccess: ["usuarios", "menu-access"] as const,
  },
  instrumentos: {
    all: ["instrumentos_clinicos"] as const,
    byId: (id: string) => ["instrumentos_clinicos", id] as const,
  },
  templates: {
    all: ["templates_versionados"] as const,
    byTipo: (tipo: string) => ["templates_versionados", tipo] as const,
  },
  financeiro: {
    kpis: (year: number, month: number) => ["financeiro", "kpis", year, month] as const,
    kpisPorTipo: (year: number, month: number) => ["financeiro", "kpisPorTipo", year, month] as const,
    receitaConvenio: (year: number, month: number) => ["financeiro", "receitaConvenio", year, month] as const,
    cobrancasSemNf: (year: number, month: number) => ["financeiro", "cobrancasSemNf", year, month] as const,
    extrato: (year: number, month: number) => ["financeiro", "extrato", year, month] as const,
  },
  periodizacao: {
    byPaciente: (pacienteId: string) => ["periodizacao", pacienteId] as const,
  },
  sessaoFisioterapeutas: {
    bySessao: (sessaoId: string) => ["sessao_fisioterapeutas", sessaoId] as const,
  },
  prontuariosConsolidados: {
    list: (search?: string) => ["prontuarios_consolidados", search ?? ""] as const,
  },
  dashboard: {
    kpis: (year: number, month: number) => ["dashboard", "kpis", year, month] as const,
    operacional: (year: number, month: number) => ["dashboard", "operacional", year, month] as const,
    proximasAgendas: () => ["dashboard", "proximasAgendas"] as const,
    divergencias: (year: number, month: number) => ["dashboard", "divergencias", year, month] as const,
    receitaMensal: (anoInicio: number, anoFim: number) => ["dashboard", "receitaMensal", anoInicio, anoFim] as const,
  },
  userRoles: {
    byUser: (id: string) => ["user_roles", id] as const,
  },
};
