/**
 * Script de migração de evoluções do Google Sites
 *
 * Uso (quando Charlene exportar o HTML):
 *   npx tsx scripts/migrate-sites-evolucao.ts --file export.html [--paciente "Nome do Paciente"] [--apply]
 *
 * O HTML exportado do Google Sites tem estrutura:
 *   <h2>Nome do Paciente</h2>
 *   <h3>DD/MM/YYYY</h3>
 *   <p>Texto da evolução...</p>
 *
 * ⚠️  PENDENTE: Charlene exportar o HTML do Google Sites
 * ⚠️  PENDENTE: Validar estrutura real do HTML com amostra de 3-5 evoluções
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
);

type EvolucaoParsed = {
  pacienteNome: string;
  data: string; // YYYY-MM-DD
  texto: string;
  fonte: "sites_import";
};

function parseDataPT(s: string): string | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// ⚠️  Parser esqueleto — ajustar quando o HTML real for fornecido
function parseGoogleSitesHTML(html: string, pacienteFiltro?: string): EvolucaoParsed[] {
  const evolucoes: EvolucaoParsed[] = [];
  // Padrão esperado: <h2> = paciente, <h3> = data, <p>s seguintes = evolução
  // TODO: ajustar seletores para estrutura real do HTML
  const blocoRegex = /<h2[^>]*>(.*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;
  let bloco: RegExpExecArray | null;
  while ((bloco = blocoRegex.exec(html)) !== null) {
    const paciente = bloco[1].replace(/<[^>]+>/g, "").trim();
    if (pacienteFiltro && !paciente.toLowerCase().includes(pacienteFiltro.toLowerCase())) continue;
    const corpo = bloco[2];
    const entradaRegex = /<h3[^>]*>(.*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
    let entrada: RegExpExecArray | null;
    while ((entrada = entradaRegex.exec(corpo)) !== null) {
      const dataStr = entrada[1].replace(/<[^>]+>/g, "").trim();
      const data = parseDataPT(dataStr);
      if (!data) continue;
      const texto = entrada[2].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
      if (!texto) continue;
      evolucoes.push({ pacienteNome: paciente, data, texto, fonte: "sites_import" });
    }
  }
  return evolucoes;
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const isDryRun = !args.includes("--apply");
  const pacFiltro =
    args.indexOf("--paciente") !== -1 ? args[args.indexOf("--paciente") + 1] : undefined;

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error(
      "❌ Uso: npx tsx scripts/migrate-sites-evolucao.ts --file export.html [--paciente Nome] [--apply]"
    );
    console.error("⚠️  PENDENTE: Charlene exportar o HTML do Google Sites");
    process.exit(0); // sai graciosamente — arquivo ainda não disponível
  }

  const html = fs.readFileSync(path.resolve(args[fileIdx + 1]), "utf8");
  const evolucoes = parseGoogleSitesHTML(html, pacFiltro);

  console.log(`\n📊 ${evolucoes.length} evoluções parseadas`);
  console.log(`🔍 Modo: ${isDryRun ? "DRY-RUN" : "APPLY"}\n`);

  if (isDryRun) {
    evolucoes.slice(0, 5).forEach((e) => {
      console.log(`${e.pacienteNome} | ${e.data} | ${e.texto.slice(0, 80)}...`);
    });
    console.log("\n⚠️  Rode com --apply para inserir.");
    return;
  }

  // Carrega pacientes para match
  const { data: pacs } = await supabase.from("pacientes").select("id, nome");
  let ok = 0;
  const erros: string[] = [];

  for (const ev of evolucoes) {
    const match = pacs?.find((p: { id: string; nome: string }) =>
      p.nome.toLowerCase().includes(ev.pacienteNome.toLowerCase())
    );
    if (!match) {
      erros.push(`Paciente não encontrado: ${ev.pacienteNome}`);
      continue;
    }
    const { error } = await supabase.from("prontuario_evolucoes").insert({
      paciente_id: match.id,
      data: ev.data,
      subjetivo: ev.texto,
      fonte: "sites_import",
    });
    if (error) erros.push(`${ev.pacienteNome}: ${error.message}`);
    else ok++;
  }

  console.log(`✅ ${ok} inseridas | ❌ ${erros.length} erros`);
  if (erros.length) erros.slice(0, 10).forEach((e) => console.log(" ❌", e));
}

main().catch(console.error);
