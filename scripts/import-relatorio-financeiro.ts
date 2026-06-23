/**
 * Script de importação do Relatório Financeiro CB MOVE
 *
 * Uso:
 *   npx tsx scripts/import-relatorio-financeiro.ts --file caminho/para/relatorio.xlsx
 *   npx tsx scripts/import-relatorio-financeiro.ts --file caminho/para/relatorio.xlsx --apply
 *
 * Por padrão roda em modo --dry-run (não insere dados).
 * Use --apply para inserir de verdade.
 *
 * ⚠️ CONFIRMAR COM DIEGO antes de rodar --apply em produção:
 *    1. Validar amostra de 20 linhas no dry-run
 *    2. Confirmar mapeamento de colunas
 *    3. Confirmar match de pacientes (fuzzy por nome)
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapeamento de colunas do Relatório Financeiro
// ⚠️ AJUSTAR após ver o arquivo real
const COL_MAP = {
  paciente_nome:    'Paciente',       // ⚠️ CONFIRMAR COM DIEGO
  tipo:             'Tipo',           // particular | convenio | judicial | puc
  situacao_nf:      'Situação NF',    // ⚠️ CONFIRMAR
  vencimento:       'Vencimento',
  valor:            'Valor',
  forma_pagamento:  'Forma Pgto',     // ⚠️ CONFIRMAR
  competencia:      'Competência',    // MM/YYYY
  servico:          'Serviço',        // ⚠️ CONFIRMAR
};

type TipoCliente = 'particular' | 'convenio' | 'judicial' | 'puc';

function normalizarNome(nome: string): string {
  return nome.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseTipo(valor: string): TipoCliente {
  const v = valor?.toLowerCase() || '';
  if (v.includes('judicial')) return 'judicial';
  if (v.includes('convenio') || v.includes('convênio') || v.includes('unimed') || v.includes('bradesco') || v.includes('ccg')) return 'convenio';
  if (v.includes('puc')) return 'puc';
  return 'particular';
}

function parseData(valor: string | number): string | null {
  if (!valor) return null;
  if (typeof valor === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(valor);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  // DD/MM/YYYY
  const [d, m, y] = String(valor).split('/');
  if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return null;
}

function parseCompetencia(valor: string): { mes: number; ano: number } | null {
  if (!valor) return null;
  const [m, y] = String(valor).split('/');
  if (m && y) return { mes: parseInt(m), ano: parseInt(y) };
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const isDryRun = !args.includes('--apply');

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error('❌ Uso: npx tsx scripts/import-relatorio-financeiro.ts --file caminho.xlsx [--apply]');
    process.exit(1);
  }

  const filePath = path.resolve(args[fileIdx + 1]);
  console.log(`📂 Lendo: ${filePath}`);
  console.log(`🔍 Modo: ${isDryRun ? 'DRY-RUN (sem inserção)' : 'APPLY (inserindo no banco)'}\n`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`📊 ${rows.length} linhas encontradas na aba "${sheetName}"\n`);

  // Carrega pacientes para match
  const { data: pacientesDb } = await supabase.from('pacientes').select('id, nome, tipo');
  const pacientes = pacientesDb || [];

  let ok = 0, skip = 0;
  const errors: string[] = [];
  const preview = isDryRun ? rows.slice(0, 20) : rows;

  for (const row of preview) {
    const nome = String(row[COL_MAP.paciente_nome] || '');
    if (!nome) { skip++; continue; }

    // Match fuzzy por nome
    const nomeNorm = normalizarNome(nome);
    const match = pacientes.find(p => normalizarNome(p.nome).includes(nomeNorm) || nomeNorm.includes(normalizarNome(p.nome)));

    const vencimento = parseData(row[COL_MAP.vencimento] as string | number);
    const competencia = parseCompetencia(row[COL_MAP.competencia] as string);
    const valor = parseFloat(String(row[COL_MAP.valor] || '0').replace(',', '.').replace(/[^0-9.]/g, ''));
    const tipo = parseTipo(String(row[COL_MAP.tipo] || ''));

    const logRow = {
      nome,
      matchPaciente: match?.nome || '❌ NÃO ENCONTRADO',
      tipo,
      vencimento,
      competencia,
      valor,
    };

    if (isDryRun) {
      console.log(JSON.stringify(logRow, null, 2));
    }

    if (!match) {
      errors.push(`Paciente não encontrado: "${nome}"`);
      skip++;
      continue;
    }

    if (!isDryRun && competencia) {
      const { error } = await supabase.from('cobrancas').insert({
        paciente_id: match.id,
        competencia_mes: competencia.mes,
        competencia_ano: competencia.ano,
        tipo,
        regime: 'mensalista', // ⚠️ AJUSTAR baseado na coluna do arquivo
        servico: String(row[COL_MAP.servico] || 'Fisioterapia Neurológica'),
        valor,
        forma_pagamento: 'deposito', // ⚠️ AJUSTAR baseado na coluna
        vencimento: vencimento || new Date().toISOString().split('T')[0],
        status: 'pendente',
        observacoes: 'migrado_logjur',
      });
      if (error) errors.push(`${nome}: ${error.message}`);
      else ok++;
    } else if (isDryRun) {
      ok++;
    }
  }

  console.log(`\n✅ OK: ${ok} | ⏭️ Pulados: ${skip} | ❌ Erros: ${errors.length}`);
  if (errors.length) {
    console.log('\nErros:');
    errors.forEach(e => console.log(' -', e));
  }
  if (isDryRun) {
    console.log('\n⚠️  Rode com --apply para inserir de verdade. Confirme a amostra acima com Diego primeiro.');
  }
}

main().catch(console.error);
