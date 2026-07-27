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
  diasDiferenca: number;
  confianca: "alta" | "media" | "baixa";
};

// Parse CSV no formato Bradesco (padrão OFX simplificado)
export function parseCSVBradesco(content: string): TransacaoExtrato[] {
  const lines = content.split("\n").filter((l) => l.trim());
  const result: TransacaoExtrato[] = [];

  for (const line of lines) {
    const cols = line.split(";").map((c) => c.trim().replace(/"/g, ""));
    if (cols.length < 3) continue;

    // Formato Bradesco: Data;Histórico;Valor
    const [dataStr, descricao, valorStr] = cols;
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

  for (const t of transacoes.filter((t) => t.tipo === "credito")) {
    // Match por valor (tolerância ± R$ 0.01)
    const porValor = pendentes.filter((c) => Math.abs(c.valor - t.valor) <= 0.01);
    if (porValor.length === 0) continue;

    // Entre os que batem o valor, pega o mais próximo pela data
    let melhor: CobrancaSimples | null = null;
    let menorDias = 999;

    for (const c of porValor) {
      const dias =
        Math.abs(new Date(t.data).getTime() - new Date(c.vencimento).getTime()) /
        (1000 * 60 * 60 * 24);
      if (dias < menorDias) {
        menorDias = dias;
        melhor = c;
      }
    }

    if (!melhor || menorDias > 10) continue; // Ignora matches com diferença > 10 dias

    matches.push({
      transacao: t,
      cobrancaId: melhor.id,
      pacienteNome: melhor.pacienteNome,
      valorCobranca: melhor.valor,
      diferenca: Math.abs(melhor.valor - t.valor),
      diasDiferenca: Math.round(menorDias),
      confianca: menorDias <= 2 ? "alta" : menorDias <= 5 ? "media" : "baixa",
    });
  }

  return matches;
}
