/**
 * Script de importação do Relatório Financeiro CB MOVE
 *
 * Uso:
 *   npx tsx scripts/import-relatorio-financeiro.ts --file /path/to/Relatorio.xlsx
 *   npx tsx scripts/import-relatorio-financeiro.ts --file /path/to/Relatorio.xlsx --apply
 *   npx tsx scripts/import-relatorio-financeiro.ts --file /path/to/Relatorio.xlsx --apply --aba JUNHO
 *
 * Por padrão: dry-run (não insere). Use --apply para escrever no Supabase.
 * Use --aba NOME para importar só uma aba.
 *
 * Valide o dry-run com Diego antes de rodar --apply.
 */

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapeamento aba → mês
const ABA_MES: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARÇO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

function normNome(n: string) {
  return n.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseValor(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[R$\s]/g, '').replace(',', '.');
  const f = parseFloat(s);
  return isNaN(f) ? null : f;
}

function parseSerial(v: unknown): string {
  if (typeof v !== 'number' || v < 40000) return '';
  const d = XLSX.SSF.parse_date_code(v as number);
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

function inferStatus(sit: string): string {
  const s = sit.toLowerCase();
  if (/\bpago\b/.test(s)) return 'pago';
  if (/atrasad|pagamento atrasad/.test(s)) return 'atrasado';
  if (/vai faltar|falta pagar/.test(s)) return 'pendente';
  if (/referente a (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/.test(s)) return 'regularizar_retroativa';
  if (/sharepoint|convênio|convenio/.test(s)) return 'aguardando_convenio';
  if (/judicial|alvará|alvara/.test(s)) return 'aguardando_alvara';
  return 'pendente';
}

function inferFormaPgto(sit: string): string {
  const s = sit.toLowerCase();
  if (/\bboleto\b/.test(s)) return 'boleto';
  if (/\bpix\b/.test(s)) return 'transferencia';
  if (/deposit/.test(s)) return 'deposito';
  if (/judicial|alvará|alvara/.test(s)) return 'alvara_judicial';
  if (/sharepoint|convênio|convenio/.test(s)) return 'convenio_direto';
  return 'deposito';
}

function inferTipo(sit: string, plano: string): string {
  const s = sit.toLowerCase();
  if (/judicial|alvará|alvara|processo/.test(s)) return 'judicial';
  if (/sharepoint|unimed|ccg|bradesco|convênio|convenio/.test(s)) return 'convenio';
  return 'particular';
}

function inferVencimento(sit: string, mes: number, ano: number): string {
  const m = sit.match(/dia\s*0?(\d{1,2})/i);
  const dia = m ? parseInt(m[1]) : 15;
  const d = Math.min(dia, new Date(ano, mes, 0).getDate());
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function inferRegime(plano: string): string {
  const p = plano.trim().toLowerCase();
  if (p.includes('sessão') || p.includes('sessao') || p === 'por sessão') return 'por_sessao';
  return 'mensalista';
}

function deveIgnorar(row: unknown[]): boolean {
  const nome = String(row[0] ?? '').trim();
  const plano = String(row[5] ?? '').trim();
  const sit = String(row[9] ?? '').toLowerCase().trim();
  if (!nome || nome.length < 3) return true;
  if (nome === 'Nome do Paciente') return true;
  if (plano === '*****' || plano === '-') return true;
  if (sit.includes('sem cobran')) return true;
  return false;
}

type CobrancaRow = {
  pacienteNome: string;
  matchNome: string;
  matchId: string | null;
  novoP: boolean;
  tipo: string;
  regime: string;
  competenciaMes: number;
  competenciaAno: number;
  vencimento: string;
  valor: number | null;
  status: string;
  formaPgto: string;
  qtdSessoes: number | null;
  obs: string;
  alertas: string[];
};

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const isDryRun = !args.includes('--apply');
  const abaIdx = args.indexOf('--aba'); const abaFiltro = abaIdx !== -1 ? (args[abaIdx + 1] ?? '').toUpperCase() || null : null;

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error('❌ Uso: npx tsx scripts/import-relatorio-financeiro.ts --file caminho.xlsx [--apply] [--aba JUNHO]');
    process.exit(1);
  }

  const filePath = path.resolve(args[fileIdx + 1]);
  console.log(`\n📂 Arquivo: ${filePath}`);
  console.log(`🔍 Modo: ${isDryRun ? 'DRY-RUN' : '⚠️  APPLY — inserindo no Supabase'}`);
  if (abaFiltro) console.log(`📋 Aba: ${abaFiltro}\n`);
  else console.log(`📋 Abas: todas\n`);

  const wb = XLSX.readFile(filePath);
  const abas = abaFiltro ? [abaFiltro] : wb.SheetNames.filter(n => ABA_MES[n.toUpperCase()]);

  // Carrega pacientes do Supabase para match
  const { data: pacs } = await supabase.from('pacientes').select('id, nome, tipo');
  const pacientes = pacs ?? [];

  let totalLinhas = 0, totalPacientesNovos = 0, totalMatch = 0, totalIgnoradas = 0;
  const todasCobrancas: CobrancaRow[] = [];

  for (const nomAba of abas) {
    const ws = wb.Sheets[nomAba];
    if (!ws) { console.warn(`⚠️  Aba "${nomAba}" não encontrada`); continue; }

    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const nonEmpty = rows.filter(r => (r as unknown[]).some(c => c !== ''));
    const dados = nonEmpty.slice(2); // pula linha da data e linha de headers
    const mes = ABA_MES[nomAba.toUpperCase()] ?? 1;
    const ano = 2026;

    console.log(`\n=== ABA ${nomAba} (${mes}/${ano}) — ${dados.length} linhas ===`);

    for (const row of dados) {
      if (deveIgnorar(row)) { totalIgnoradas++; continue; }
      totalLinhas++;

      const nome = String(row[0]).trim();
      const plano = String(row[5] ?? '').trim();
      const sit = String(row[9] ?? '').trim();
      const qtd = row[4] ? parseInt(String(row[4])) : null;
      const valor = parseValor(row[7]);

      const nomNorm = normNome(nome);
      const match = pacientes.find(p => {
        const pNorm = normNome(p.nome);
        const sim = pNorm === nomNorm ||
          pNorm.includes(nomNorm) || nomNorm.includes(pNorm) ||
          levenshteinSim(nomNorm, pNorm) >= 0.82;
        return sim;
      });

      const alertas: string[] = [];
      if (!valor) alertas.push('VALOR VAZIO');
      if (!match) alertas.push('PACIENTE NÃO ENCONTRADO — criará novo');
      if (valor && valor > 50000) alertas.push(`VALOR ALTO: R$ ${valor}`);
      if (!isNaN(qtd as number) && (qtd as number) > 25) alertas.push(`SESSÕES ALTO: ${qtd}`);

      const cob: CobrancaRow = {
        pacienteNome: nome,
        matchNome: match?.nome ?? '(novo)',
        matchId: match?.id ?? null,
        novoP: !match,
        tipo: inferTipo(sit, plano),
        regime: inferRegime(plano),
        competenciaMes: mes,
        competenciaAno: ano,
        vencimento: inferVencimento(sit, mes, ano),
        valor,
        status: inferStatus(sit),
        formaPgto: inferFormaPgto(sit),
        qtdSessoes: isNaN(qtd as number) ? null : qtd,
        obs: `migrado_logjur | ${sit}`.trim().replace(/\s+/g, ' '),
        alertas,
      };

      if (match) totalMatch++; else totalPacientesNovos++;
      todasCobrancas.push(cob);
    }
  }

  // ─── RELATÓRIO ────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMO DO DRY-RUN');
  console.log('═'.repeat(60));
  console.log(`Total linhas lidas:         ${totalLinhas}`);
  console.log(`Linhas ignoradas:           ${totalIgnoradas} (sem cobrança, separadores)`);
  console.log(`Match com paciente:         ${totalMatch}`);
  console.log(`Pacientes novos:            ${totalPacientesNovos}`);
  console.log(`Cobranças a inserir:        ${todasCobrancas.length}`);
  const comAlerta = todasCobrancas.filter(c => c.alertas.length > 0);
  console.log(`Com alertas:                ${comAlerta.length}`);

  // Amostra 20 linhas
  console.log('\n' + '─'.repeat(60));
  console.log('📋 AMOSTRA — primeiras 20 cobranças');
  console.log('─'.repeat(60));
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  console.log(pad('Paciente', 32) + pad('Tipo', 10) + pad('Comp.', 8) + pad('Vencim.', 12) + pad('Valor', 12) + pad('Status', 22) + 'FormaPgto');
  console.log('-'.repeat(120));
  todasCobrancas.slice(0, 20).forEach(c => {
    const comp = `${c.competenciaMes}/${c.competenciaAno}`;
    const val = c.valor != null ? `R$ ${c.valor.toFixed(2)}` : '⚠️  VAZIO';
    console.log(pad(c.pacienteNome, 32) + pad(c.tipo, 10) + pad(comp, 8) + pad(c.vencimento, 12) + pad(val, 12) + pad(c.status, 22) + c.formaPgto);
  });

  // Alertas
  if (comAlerta.length > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('⚠️  ALERTAS');
    console.log('─'.repeat(60));
    comAlerta.slice(0, 30).forEach(c => {
      console.log(`  ${c.pacienteNome}: ${c.alertas.join(' | ')}`);
    });
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY-RUN concluído. Valide a amostra acima com Mariana e Diego.');
    console.log('   Rode com --apply para inserir de verdade.\n');
    return;
  }

  // ─── APPLY ────────────────────────────────────────────────────
  console.log('\n\n🚀 APPLY — inserindo no Supabase...\n');
  let ok = 0, erros: string[] = [];

  for (const c of todasCobrancas) {
    let pacId = c.matchId;

    // Cria paciente se não encontrado
    if (!pacId) {
      const { data: np, error: ne } = await supabase
        .from('pacientes')
        .insert({ nome: c.pacienteNome, tipo: c.tipo })
        .select('id')
        .single();
      if (ne || !np) { erros.push(`CRIARPAC ${c.pacienteNome}: ${ne?.message}`); continue; }
      pacId = np.id;
      console.log(`  ✅ Novo paciente: ${c.pacienteNome} (${pacId})`);
    }

    if (!c.valor) {
      erros.push(`VALORVAZIO ${c.pacienteNome} ${c.competenciaMes}/${c.competenciaAno}`);
      continue;
    }

    const { error } = await supabase.from('cobrancas').insert({
      paciente_id: pacId,
      competencia_mes: c.competenciaMes,
      competencia_ano: c.competenciaAno,
      tipo: c.tipo,
      regime: c.regime,
      servico: 'Fisioterapia Neurológica',
      valor: c.valor,
      forma_pagamento: c.formaPgto,
      vencimento: c.vencimento,
      status: c.status,
      qtd_sessoes: c.qtdSessoes,
      observacoes: c.obs,
    });

    if (error) erros.push(`COBRANÇA ${c.pacienteNome}: ${error.message}`);
    else ok++;
  }

  console.log(`\n✅ Inseridas: ${ok} | ❌ Erros: ${erros.length}`);
  if (erros.length) erros.forEach(e => console.log('  ❌', e));
}

// Similaridade de Levenshtein simplificada
function levenshteinSim(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (!la || !lb) return 0;
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) => [i, ...Array(lb).fill(0)]);
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[la][lb] / Math.max(la, lb);
}

main().catch(console.error);
