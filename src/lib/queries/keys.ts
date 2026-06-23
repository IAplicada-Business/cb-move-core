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
    monthCount: (year: number, month: number) => ["notas_fiscais", "monthCount", year, month] as const,
  },
  convenios: { all: ["convenios"] as const },
  userRoles: { byUser: (id: string) => ["user_roles", id] as const },
};
