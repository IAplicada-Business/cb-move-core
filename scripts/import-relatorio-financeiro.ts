/**
 * Script de importação do Relatório Financeiro CB MOVE
 *
 * Uso:
 *   npx tsx scripts/import-relatorio-financeiro.ts --file /path/to/Relatorio.xlsx
 *   npx tsx scripts/import-relatorio-financeiro.ts --file /path/to/Relatorio.xlsx --apply
 *   npx tsx scripts/import-relatorio-financeiro.ts --file /path/to/Relatorio.xlsx --aba JUNHO
 *
 * Regras aplicadas:
 *   R2: Valor vazio → data/_revisar_valores_vazios.csv (NÃO inserir R$0)
 *   R3: SHAREPOINT = modelo_relatorio_preferido='sharepoint', tipo='convenio'
 *   R4: Múltiplas linhas por paciente = cobranças separadas (servico diferencia)
 *   R5: Competências retroativas em SITUAÇÃO → cobranças extras com valor dividido
 */

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ABA_MES: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARÇO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

const MES_NOME: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
};

// ─── helpers ───────────────────────────────────────────────────────────────

function normNome(n: string) {
  return n.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseValor(v: unknown): number | null {
  if (typeof v === 'number' && v > 0) return v;
  const s = String(v ?? '').replace(/[R$\s]/g, '').replace(',', '.');
  const f = parseFloat(s);
  return isNaN(f) || f <= 0 ? null : f;
}

// REGRA 5: extrai competências retroativas mencionadas em SITUAÇÃO
// Padrões: "falta 022026", "022026", "02/2026", "02/26"
function parseDatasRetroativas(
  sit: string,
  mesAtual: number,
  anoAtual: number,
): Array<{ mes: number; ano: number }> {
  const found: Array<{ mes: number; ano: number }> = [];
  const dedup = (mes: number, ano: number) => {
    if (ano > anoAtual || (ano === anoAtual && mes >= mesAtual)) return;
    if (ano < 2020 || ano > 2030) return;
    if (!found.some(f => f.mes === mes && f.ano === ano)) found.push({ mes, ano });
  };

  // padrão numérico: "022026", "02/2026", "02/26"
  const patsNum = [
    /\b(0?[1-9]|1[0-2])\/?(\d{4})\b/g,
    /\b(0?[1-9]|1[0-2])\/(\d{2})\b/g,
  ];
  for (const pat of patsNum) {
    let m: RegExpExecArray | null;
    while ((m = pat.exec(sit)) !== null) {
      const anoRaw = parseInt(m[2]);
      dedup(parseInt(m[1]), anoRaw < 100 ? 2000 + anoRaw : anoRaw);
    }
  }

  // padrão por extenso PT-BR: "dezembro 2025", "referente a novembro 2025"
  const MESES_PT: Record<string, number> = {
    janeiro:1, fevereiro:2, marco:3, abril:4, maio:5, junho:6,
    julho:7, agosto:8, setembro:9, outubro:10, novembro:11, dezembro:12,
  };
  const patExtenso = /\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{4})\b/gi;
  let mx: RegExpExecArray | null;
  while ((mx = patExtenso.exec(sit)) !== null) {
    const key = mx[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ ]/g, '');
    const mesNum = MESES_PT[key === 'marco' ? 'marco' : key];
    if (mesNum) dedup(mesNum, parseInt(mx[2]));
  }

  return found;
}

// REGRA 3: SHAREPOINT → modelo_relatorio, não forma_pagamento
function inferModelo(sit: string): string {
  const s = sit.toLowerCase();
  if (/sharepoint/.test(s)) return 'sharepoint';
  if (/unimed/.test(s)) return 'unimed';
  return 'convencional';
}

function inferTipo(sit: string): string {
  const s = sit.toLowerCase();
  if (/judicial|alvará|alvara|processo/.test(s)) return 'judicial';
  if (/sharepoint|unimed|ccg|bradesco\s+segu|convênio|convenio/.test(s)) return 'convenio';
  return 'particular';
}

function inferFormaPgto(sit: string): string {
  const s = sit.toLowerCase();
  // SHAREPOINT não é forma_pagamento (R3) — removido daqui
  if (/\bboleto\b/.test(s)) return 'boleto';
  if (/\bpix\b/.test(s)) return 'transferencia';
  if (/\bdeposit/.test(s)) return 'deposito';
  if (/judicial|alvará|alvara/.test(s)) return 'alvara_judicial';
  if (/convenio_direto|convênio direto/.test(s)) return 'convenio_direto';
  return 'deposito';
}

function inferStatus(sit: string, temRetroativas: boolean): string {
  const s = sit.toLowerCase();
  if (/\bpago\b/.test(s)) return 'pago';
  if (/atrasad/.test(s) || temRetroativas) return 'atrasado';
  if (/vai faltar|falta pagar/.test(s)) return 'pendente';
  if (/sharepoint/.test(s)) return 'aguardando_convenio';
  if (/judicial|alvará|alvara/.test(s)) return 'aguardando_alvara';
  return 'pendente';
}

function inferVencimento(sit: string, mes: number, ano: number): string {
  const m = sit.match(/dia\s*0?(\d{1,2})/i);
  const dia = m ? Math.min(parseInt(m[1]), 28) : 15;
  const lastDay = new Date(ano, mes, 0).getDate();
  const d = Math.min(dia, lastDay);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function inferRegime(plano: string): string {
  const p = plano.trim().toLowerCase();
  return p.includes('sessão') || p.includes('sessao') ? 'por_sessao' : 'mensalista';
}

// REGRA 4: servico descreve o plano para diferenciar múltiplas cobranças do mesmo paciente
function inferServico(frequencia: string, plano: string, mes: number, ano: number): string {
  const f = frequencia.toLowerCase();
  const suffix = `${MES_NOME[mes]}/${ano}`;
  if (f.includes('triplo')) return `Plano triplo ${suffix}`;
  if (f.includes('duplo')) return `Plano duplo ${suffix}`;
  return `Fisioterapia Neurológica ${suffix}`;
}

function deveIgnorar(row: unknown[]): boolean {
  const nome = String(row[0] ?? '').trim();
  const plano = String(row[5] ?? '').trim();
  const sit = String(row[9] ?? '').toLowerCase().trim();
  if (!nome || nome.length < 3) return true;
  if (nome === 'Nome do Paciente') return true;
  if (plano === '*****') return true;
  if (sit.includes('sem cobran')) return true;
  return false;
}

function levenshteinSim(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (!la || !lb) return 0;
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    i === 0 ? Array.from({ length: lb + 1 }, (_, j) => j) : [i, ...Array(lb).fill(0)]
  );
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[la][lb] / Math.max(la, lb);
}

// ─── tipos ──────────────────────────────────────────────────────────────────

type CobrancaRow = {
  pacienteNome: string;
  matchId: string | null;
  novoP: boolean;
  tipo: string;
  modelo: string;
  regime: string;
  servico: string;
  competenciaMes: number;
  competenciaAno: number;
  vencimento: string;
  valor: number;
  status: string;
  formaPgto: string;
  qtdSessoes: number | null;
  obs: string;
  isRetroativa: boolean;
  alertas: string[];
};

type ValorVazioRow = {
  paciente: string;
  aba: string;
  mes: number;
  ano: number;
  situacao: string;
};

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const isDryRun = !args.includes('--apply');
  const abaIdx = args.indexOf('--aba');
  const abaFiltro = abaIdx !== -1 ? (args[abaIdx + 1] ?? '').toUpperCase() || null : null;

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error('❌ Uso: npx tsx scripts/import-relatorio-financeiro.ts --file caminho.xlsx [--apply] [--aba JUNHO]');
    process.exit(1);
  }

  const filePath = path.resolve(args[fileIdx + 1]);
  console.log(`\n📂 Arquivo: ${filePath}`);
  console.log(`🔍 Modo: ${isDryRun ? 'DRY-RUN' : '⚠️  APPLY — inserindo no Supabase'}`);
  console.log(`📋 Abas: ${abaFiltro ?? 'todas'}\n`);

  const wb = XLSX.readFile(filePath);
  const abas = abaFiltro ? [abaFiltro] : wb.SheetNames.filter(n => ABA_MES[n.toUpperCase()]);

  const { data: pacs } = await supabase.from('pacientes').select('id, nome, tipo');
  const pacientesDb = pacs ?? [];

  const todasCobrancas: CobrancaRow[] = [];
  const valoresVazios: ValorVazioRow[] = [];
  // Track novos pacientes para não duplicar no dry-run
  const novosNomes = new Set<string>();

  let totalLinhasLidas = 0, totalIgnoradas = 0;

  for (const nomAba of abas) {
    const ws = wb.Sheets[nomAba];
    if (!ws) { console.warn(`⚠️  Aba "${nomAba}" não encontrada`); continue; }

    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const nonEmpty = rows.filter(r => r.some(c => c !== ''));
    const dados = nonEmpty.slice(2);
    const mes = ABA_MES[nomAba.toUpperCase()] ?? 1;
    const ano = 2026;

    console.log(`=== ABA ${nomAba} (${mes}/${ano}) — ${dados.length} linhas brutas ===`);

    for (const row of dados) {
      if (deveIgnorar(row)) { totalIgnoradas++; continue; }
      totalLinhasLidas++;

      const nome       = String(row[0]).trim();
      const frequencia = String(row[2] ?? '').trim();
      const plano      = String(row[5] ?? '').trim();
      const valorRaw   = row[7];
      const sit        = String(row[9] ?? '').trim();
      const qtdRaw     = row[4];

      const valor = parseValor(valorRaw);

      // REGRA 2: valor vazio → CSV de revisão, NÃO inserir
      if (valor === null) {
        valoresVazios.push({ paciente: nome, aba: nomAba, mes, ano, situacao: sit });
        continue;
      }

      // match fuzzy com pacientes existentes
      const nomNorm = normNome(nome);
      const match = pacientesDb.find(p => {
        const pn = normNome(p.nome);
        return pn === nomNorm || pn.includes(nomNorm) || nomNorm.includes(pn)
          || levenshteinSim(nomNorm, pn) >= 0.82;
      });

      const tipo   = inferTipo(sit);
      const modelo = inferModelo(sit);

      // REGRA 5: detecta competências retroativas
      const retroativas = parseDatasRetroativas(sit, mes, ano);
      const temRetro = retroativas.length > 0;
      const totalCompetencias = retroativas.length + 1; // +1 = mês atual
      const valorPorComp = Math.round((valor / totalCompetencias) * 100) / 100;
      // última parcela absorve centavos de arredondamento
      const valorUltima = Math.round((valor - valorPorComp * (totalCompetencias - 1)) * 100) / 100;

      const alertas: string[] = [];
      if (!match && !novosNomes.has(normNome(nome))) alertas.push('novo paciente');
      if (valor > 50000) alertas.push(`VALOR ALTO: R$ ${valor}`);
      if (temRetro) alertas.push(`${retroativas.length} retroativa(s) detectada(s)`);

      const qtd = qtdRaw ? parseInt(String(qtdRaw)) : null;
      const baseObs = `migrado_logjur | ${sit}`.trim().replace(/\s+/g, ' ');

      // Cobranças retroativas (REGRA 5)
      retroativas.forEach((ret, i) => {
        const isLast = i === retroativas.length - 1 && retroativas.length === totalCompetencias - 1;
        todasCobrancas.push({
          pacienteNome: nome,
          matchId: match?.id ?? null,
          novoP: !match,
          tipo,
          modelo,
          regime: inferRegime(plano),
          servico: `${inferServico(frequencia, plano, ret.mes, ret.ano)} [retroativa]`,
          competenciaMes: ret.mes,
          competenciaAno: ret.ano,
          vencimento: inferVencimento(sit, ret.mes, ret.ano),
          valor: isLast ? valorUltima : valorPorComp,
          status: 'regularizar_retroativa',
          formaPgto: inferFormaPgto(sit),
          qtdSessoes: null,
          obs: `Retroativa detectada no relatório financeiro | ${baseObs}`,
          isRetroativa: true,
          alertas: [],
        });
      });

      // Cobrança do mês atual
      const valorAtual = temRetro ? valorUltima : valor;
      todasCobrancas.push({
        pacienteNome: nome,
        matchId: match?.id ?? null,
        novoP: !match,
        tipo,
        modelo,
        regime: inferRegime(plano),
        servico: inferServico(frequencia, plano, mes, ano),
        competenciaMes: mes,
        competenciaAno: ano,
        vencimento: inferVencimento(sit, mes, ano),
        valor: valorAtual,
        status: inferStatus(sit, temRetro),
        formaPgto: inferFormaPgto(sit),
        qtdSessoes: isNaN(qtd as number) ? null : qtd,
        obs: baseObs,
        isRetroativa: false,
        alertas,
      });

      if (!match) novosNomes.add(normNome(nome));
    }
  }

  // ─── REGRA 2: salva CSV de revisão ──────────────────────────────────────
  if (valoresVazios.length > 0) {
    const csvDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });
    const csvPath = path.join(csvDir, '_revisar_valores_vazios.csv');
    const header = 'paciente,aba,mes,ano,situacao\n';
    const body = valoresVazios
      .map(r => `"${r.paciente}","${r.aba}",${r.mes},${r.ano},"${r.situacao.replace(/"/g, '""')}"`)
      .join('\n');
    fs.writeFileSync(csvPath, header + body, 'utf8');
    console.log(`\n📄 ${valoresVazios.length} linhas com valor vazio → ${csvPath}`);
  }

  // ─── RELATÓRIO ───────────────────────────────────────────────────────────
  const novosTotal = new Set(todasCobrancas.filter(c => c.novoP).map(c => normNome(c.pacienteNome))).size;
  const retroTotal = todasCobrancas.filter(c => c.isRetroativa).length;
  const distTipo = todasCobrancas.reduce<Record<string, number>>((acc, c) => {
    acc[c.tipo] = (acc[c.tipo] ?? 0) + 1; return acc;
  }, {});
  const distModelo = todasCobrancas.reduce<Record<string, number>>((acc, c) => {
    acc[c.modelo] = (acc[c.modelo] ?? 0) + 1; return acc;
  }, {});

  console.log('\n' + '═'.repeat(65));
  console.log('📊 RESUMO DO DRY-RUN');
  console.log('═'.repeat(65));
  console.log(`Total linhas lidas:              ${totalLinhasLidas}`);
  console.log(`Linhas ignoradas (separadores):  ${totalIgnoradas}`);
  console.log(`Linhas com valor vazio (→ CSV):  ${valoresVazios.length}`);
  console.log(`Pacientes novos a criar:         ${novosTotal}`);
  console.log(`Cobranças a inserir (total):     ${todasCobrancas.length}`);
  console.log(`  → retroativas geradas (R5):    ${retroTotal}`);
  console.log(`  → mês corrente:                ${todasCobrancas.length - retroTotal}`);
  console.log(`Distribuição por tipo:           ${Object.entries(distTipo).map(([k,v])=>`${k}=${v}`).join(', ')}`);
  console.log(`Distribuição por modelo:         ${Object.entries(distModelo).map(([k,v])=>`${k}=${v}`).join(', ')}`);

  // Amostra 20 cobranças
  console.log('\n' + '─'.repeat(65));
  console.log('📋 AMOSTRA — primeiras 20 cobranças');
  console.log('─'.repeat(65));
  const pad = (s: string, n: number) => String(s).slice(0, n).padEnd(n);
  console.log(
    pad('Paciente', 30) + pad('Tipo', 10) + pad('Comp.', 8) +
    pad('Vencim.', 12) + pad('Valor', 11) + pad('Status', 23) + pad('Modelo', 13) + 'FormaPgto'
  );
  console.log('-'.repeat(130));
  todasCobrancas.slice(0, 20).forEach(c => {
    const retTag = c.isRetroativa ? '🔁' : '  ';
    const comp   = `${c.competenciaMes}/${c.competenciaAno}`;
    const val    = `R$ ${c.valor.toFixed(2)}`;
    console.log(
      retTag + pad(c.pacienteNome, 28) + pad(c.tipo, 10) + pad(comp, 8) +
      pad(c.vencimento, 12) + pad(val, 11) + pad(c.status, 23) + pad(c.modelo, 13) + c.formaPgto
    );
  });

  // Alertas
  const comAlerta = todasCobrancas.filter(c => c.alertas.length > 0);
  if (comAlerta.length > 0) {
    console.log('\n' + '─'.repeat(65));
    console.log('⚠️  ALERTAS (primeiros 20)');
    console.log('─'.repeat(65));
    comAlerta.slice(0, 20).forEach(c => {
      console.log(`  ${c.pacienteNome} [${c.competenciaMes}/${c.competenciaAno}]: ${c.alertas.join(' | ')}`);
    });
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY-RUN concluído. Valide a amostra com Mariana e Diego antes de --apply.\n');
    return;
  }

  // ─── APPLY ───────────────────────────────────────────────────────────────
  console.log('\n🚀 APPLY — inserindo no Supabase...\n');
  // Cache de pacientes criados nesta sessão para não duplicar
  const criadosCache = new Map<string, string>(); // normNome → id
  let ok = 0;
  const erros: string[] = [];

  for (const c of todasCobrancas) {
    const normN = normNome(c.pacienteNome);
    let pacId = c.matchId ?? criadosCache.get(normN) ?? null;

    if (!pacId) {
      const { data: np, error: ne } = await supabase
        .from('pacientes')
        .insert({ nome: c.pacienteNome, tipo: c.tipo, modelo_relatorio_preferido: c.modelo })
        .select('id')
        .single();
      if (ne || !np) { erros.push(`CRIARPAC ${c.pacienteNome}: ${ne?.message}`); continue; }
      pacId = np.id;
      criadosCache.set(normN, pacId);
      console.log(`  ✅ Novo paciente: ${c.pacienteNome}`);
    }

    const { error } = await supabase.from('cobrancas').insert({
      paciente_id:     pacId,
      competencia_mes: c.competenciaMes,
      competencia_ano: c.competenciaAno,
      tipo:            c.tipo,
      regime:          c.regime,
      servico:         c.servico,
      valor:           c.valor,
      forma_pagamento: c.formaPgto,
      vencimento:      c.vencimento,
      status:          c.status,
      qtd_sessoes:     c.qtdSessoes,
      observacoes:     c.obs,
    });

    if (error) erros.push(`COBRANÇA ${c.pacienteNome} ${c.competenciaMes}/${c.competenciaAno}: ${error.message}`);
    else ok++;
  }

  console.log(`\n✅ Inseridas: ${ok} | ❌ Erros: ${erros.length}`);
  if (erros.length) erros.slice(0, 20).forEach(e => console.log('  ❌', e));
}

main().catch(console.error);
