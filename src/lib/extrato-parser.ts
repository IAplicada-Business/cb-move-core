export type TransacaoExtrato = {
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
};

export type MatchCobranca = {
  transacao: TransacaoExtrato;
  cobrancaId: string;
  pacienteNome: string;
  valorCobranca: number;
  diferenca: number;
  /** Diferença em dias úteis (seg–sex) entre extrato e vencimento. */
  diasDiferenca: number;
  confianca: "alta" | "media" | "baixa";
};

/** Conta dias úteis absolutos entre duas datas YYYY-MM-DD (exclui sábado/domingo). */
export function diasUteisEntre(aIso: string, bIso: string): number {
  const a = new Date(`${aIso.slice(0, 10)}T12:00:00`);
  const b = new Date(`${bIso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 999;

  const start = a <= b ? a : b;
  const end = a <= b ? b : a;
  let dias = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dias += 1;
  }
  return dias;
}

// Parse CSV no formato Bradesco (padrão OFX simplificado)
export function parseCSVBradesco(content: string): TransacaoExtrato[] {
  const lines = content.split("\n").filter((l) => l.trim());
  const result: TransacaoExtrato[] = [];

  for (const line of lines) {
    const cols = line.split(";").map((c) => c.trim().replace(/"/g, ""));
    if (cols.length < 3) continue;

    // Formato Bradesco: Data;Histórico;Valor
    const [dataStr, descricao, valorStr] = cols;
    // Pula cabeçalho
    if (/^data$/i.test(dataStr) || /historico/i.test(descricao)) continue;

    const [d, m, y] = dataStr.split("/");
    if (!d || !m || !y) continue;

    const valor = parseFloat(valorStr.replace(",", ".").replace(/[^0-9.-]/g, ""));
    if (isNaN(valor)) continue;

    result.push({
      data: `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
      descricao,
      valor: Math.abs(valor),
      tipo: valor > 0 ? "credito" : "debito",
    });
  }

  return result;
}

export function parseOFX(content: string): TransacaoExtrato[] {
  const result: TransacaoExtrato[] = [];
  const transRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;

  while ((match = transRegex.exec(content)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<]+)`));
      return m ? m[1].trim() : "";
    };

    const dtposted = get("DTPOSTED"); // YYYYMMDD
    const trnamt = parseFloat(get("TRNAMT"));
    const memo = get("MEMO") || get("NAME");

    if (!dtposted || isNaN(trnamt)) continue;

    const data = `${dtposted.slice(0, 4)}-${dtposted.slice(4, 6)}-${dtposted.slice(6, 8)}`;
    result.push({
      data,
      descricao: memo,
      valor: Math.abs(trnamt),
      tipo: trnamt > 0 ? "credito" : "debito",
    });
  }

  return result;
}

type CobrancaSimples = {
  id: string;
  pacienteNome: string;
  valor: number;
  vencimento: string;
  status: string;
};

/** Janela máxima de match: ±5 dias úteis (docs/regras_fiscais.md). */
const MAX_DIAS_UTEIS = 5;

export function matchTransacoesComCobrancas(
  transacoes: TransacaoExtrato[],
  cobrancas: CobrancaSimples[],
): MatchCobranca[] {
  const pendentes = cobrancas.filter((c) =>
    ["pendente", "vencido", "atrasado", "aguardando_convenio", "aguardando_alvara"].includes(
      c.status,
    ),
  );
  const matches: MatchCobranca[] = [];
  const cobrancasUsadas = new Set<string>();

  for (const t of transacoes.filter((t) => t.tipo === "credito")) {
    // Match por valor (tolerância ± R$ 0.01)
    const porValor = pendentes.filter(
      (c) => !cobrancasUsadas.has(c.id) && Math.abs(c.valor - t.valor) <= 0.01,
    );
    if (porValor.length === 0) continue;

    // Entre os que batem o valor, pega o mais próximo pela data (dias úteis)
    let melhor: CobrancaSimples | null = null;
    let menorDias = 999;

    for (const c of porValor) {
      const dias = diasUteisEntre(t.data, c.vencimento.slice(0, 10));
      if (dias < menorDias) {
        menorDias = dias;
        melhor = c;
      }
    }

    if (!melhor || menorDias > MAX_DIAS_UTEIS) continue;

    cobrancasUsadas.add(melhor.id);
    matches.push({
      transacao: t,
      cobrancaId: melhor.id,
      pacienteNome: melhor.pacienteNome,
      valorCobranca: melhor.valor,
      diferenca: Math.abs(melhor.valor - t.valor),
      diasDiferenca: menorDias,
      confianca: menorDias <= 1 ? "alta" : menorDias <= 3 ? "media" : "baixa",
    });
  }

  return matches;
}
