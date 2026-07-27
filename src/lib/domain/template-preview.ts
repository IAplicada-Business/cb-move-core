export type TemplatePreviewInput = {
  tipo: string;
  modelo: string | null;
  conteudo: unknown;
};

export type TemplatePreviewSection = {
  title: string;
  body: string;
  variant?: "muted" | "warning" | "code";
};

export type EmailTemplateVisualPreview = {
  de: string;
  para: string;
  assunto: string;
  corpoHtml: string;
  assuntoRaw: string;
  corpoHtmlRaw: string;
  placeholders: string[];
  isRascunho: boolean;
};

export type NotaFiscalVisualPreview = {
  destinatarioTipo: string;
  destinatarioExemplo: string;
  campos: { label: string; valor: string }[];
};

export type RelatorioVisualPreview = {
  titulo: string;
  campos: { label: string; valor: string }[];
};

const BASE_EMAIL_SAMPLES: Record<string, string> = {
  numero: "2085",
  competencia_label: "Jul/2026",
  valor: "R$ 2.394,00",
  pdf_url: "#",
};

const EMAIL_SAMPLES_BY_MODELO: Record<string, Record<string, string>> = {
  particular: {
    ...BASE_EMAIL_SAMPLES,
    destinatario_nome: "Amanda Pavan",
    corpo_paciente_nome: "Amanda Pavan",
    to_email: "amanda.pavan@email.com",
  },
  convenio: {
    ...BASE_EMAIL_SAMPLES,
    destinatario_nome: "Bradesco Seguros",
    corpo_paciente_nome: "Susana Vaz",
    to_email: "liminarprestador@bradescoseguros.com.br",
  },
  judicial: {
    ...BASE_EMAIL_SAMPLES,
    destinatario_nome: "Bradesco Seguros",
    corpo_paciente_nome: "Susana Vaz",
    corpo_paciente_cpf: "392.***.***-12",
    corpo_numero_processo: "5004821-82.2023.8.21.0001",
    corpo_total_sessoes: "8",
    to_email: "liminarprestador@bradescoseguros.com.br",
  },
  puc: {
    ...BASE_EMAIL_SAMPLES,
    destinatario_nome: "PUC-RS",
    corpo_paciente_nome: "Maria Silva",
    to_email: "financeiro@pucrs.br",
  },
};

const RELATORIO_SAMPLES: Record<string, Record<string, string>> = {
  convencional: {
    paciente_nome: "Amanda Pavan",
    competencia: "Jul/2026",
    evolucao_resumo: "Evolução neurológica favorável no período…",
  },
  unimed: {
    paciente_nome: "Susana Vaz",
    cid: "G80.0",
    sessoes: "12 sessões no mês",
    processo: "5081607-82.2023.8.21.0001",
  },
  sharepoint: {
    paciente_nome: "Ana Esmeralda de Quevedo Tavares",
    sessoes: "16 sessões · Jul/2026",
    fisio: "Dra. Charlene Brito",
  },
  puc: {
    paciente_nome: "Maria Silva",
    competencia: "Jul/2026",
    evolucao_resumo: "Atendimento institucional PUC…",
  },
};

const NOTA_FISCAL_DESTINATARIO: Record<string, string> = {
  paciente: "Paciente (CPF)",
  convenio: "Convênio / tomador (CNPJ)",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function formatList(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return items.map(String).join(", ");
}

function humanizePlaceholder(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Substitui {{variavel}} por valores de exemplo ou mantém a tag se faltar. */
export function substituirPlaceholdersTemplate(
  template: string,
  valores: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => valores[key] ?? `{{${key}}}`);
}

function emailSamplesForModelo(modelo: string | null): Record<string, string> {
  if (modelo && EMAIL_SAMPLES_BY_MODELO[modelo]) return EMAIL_SAMPLES_BY_MODELO[modelo];
  return EMAIL_SAMPLES_BY_MODELO.particular;
}

/** Detecta conteúdo ainda não preenchido (seed ou rascunho). */
export function isTemplateConteudoRascunho(tipo: string, conteudo: unknown): boolean {
  const data = asRecord(conteudo);
  if (!data) return true;

  if (tipo === "email_nf") {
    const corpo = data.corpo ?? data.corpo_html;
    return corpo === "placeholder" || corpo === "" || corpo == null;
  }

  if (tipo === "relatorio_atendimento") {
    return !Array.isArray(data.placeholders) || data.placeholders.length === 0;
  }

  if (tipo === "nota_fiscal") {
    return !data.destinatario;
  }

  return false;
}

export function buildEmailTemplateVisualPreview(
  modelo: string | null,
  conteudo: unknown,
): EmailTemplateVisualPreview | null {
  const data = asRecord(conteudo);
  if (!data) return null;

  const assuntoRaw = String(data.assunto ?? "");
  const corpoRaw = String(data.corpo_html ?? data.corpo ?? "");
  const isRascunho = corpoRaw === "placeholder" || !corpoRaw.trim();
  const samples = emailSamplesForModelo(modelo);

  return {
    de: "CB MOVE Neuroscience <financeiro@cbmove.com.br>",
    para: samples.to_email ?? "destinatario@exemplo.com",
    assunto: substituirPlaceholdersTemplate(assuntoRaw || "—", samples),
    corpoHtml: isRascunho
      ? "<p><em>Corpo do e-mail ainda não configurado.</em></p>"
      : substituirPlaceholdersTemplate(corpoRaw, samples),
    assuntoRaw,
    corpoHtmlRaw: corpoRaw,
    placeholders: Array.isArray(data.placeholders) ? data.placeholders.map(String) : [],
    isRascunho,
  };
}

export function buildNotaFiscalVisualPreview(
  modelo: string | null,
  conteudo: unknown,
): NotaFiscalVisualPreview | null {
  const data = asRecord(conteudo);
  if (!data) return null;

  const destinatarioKey = String(data.destinatario ?? "paciente");
  const camposRaw = Array.isArray(data.corpo) ? data.corpo.map(String) : [];

  const exemplos: Record<string, string> = {
    paciente: "Amanda Pavan",
    cpf: "035.551.100-20",
    processo: "5004821-82.2023.8.21.0001",
    sessoes: "8 sessões · Jul/2026",
  };

  return {
    destinatarioTipo: NOTA_FISCAL_DESTINATARIO[destinatarioKey] ?? destinatarioKey,
    destinatarioExemplo:
      destinatarioKey === "convenio"
        ? "Bradesco Seguros · 34.567.890/0001-12"
        : "Amanda Pavan · CPF 035.551.100-20",
    campos: camposRaw.map((key) => ({
      label: humanizePlaceholder(key),
      valor: exemplos[key] ?? `(${key})`,
    })),
  };
}

export function buildRelatorioVisualPreview(
  modelo: string | null,
  conteudo: unknown,
): RelatorioVisualPreview | null {
  const data = asRecord(conteudo);
  if (!data) return null;

  const placeholders = Array.isArray(data.placeholders) ? data.placeholders.map(String) : [];
  const samples = (modelo && RELATORIO_SAMPLES[modelo]) || RELATORIO_SAMPLES.convencional;

  const titulos: Record<string, string> = {
    convencional: "Relatório de Atendimento — Particular",
    unimed: "Relatório de Atendimento — Unimed",
    sharepoint: "Relatório de Atendimento — Judicial",
    puc: "Relatório de Atendimento — PUC",
  };

  return {
    titulo: titulos[modelo ?? "convencional"] ?? "Relatório de Atendimento",
    campos: placeholders.map((key) => ({
      label: humanizePlaceholder(key),
      valor: samples[key] ?? `Exemplo de ${humanizePlaceholder(key).toLowerCase()}`,
    })),
  };
}

/** Seções técnicas (colapsáveis) — assunto/corpo raw, variáveis, notas de sistema. */
export function buildTemplatePreviewSections(
  input: TemplatePreviewInput,
): TemplatePreviewSection[] {
  const data = asRecord(input.conteudo);
  if (!data) {
    return [{ title: "Conteúdo", body: "Sem conteúdo cadastrado.", variant: "warning" }];
  }

  if (input.tipo === "email_nf") {
    const visual = buildEmailTemplateVisualPreview(input.modelo, input.conteudo);
    const sections: TemplatePreviewSection[] = [];
    if (visual) {
      sections.push({
        title: "Assunto (template)",
        body: visual.assuntoRaw || "—",
        variant: "code",
      });
      if (visual.corpoHtmlRaw && visual.corpoHtmlRaw !== "placeholder") {
        sections.push({ title: "HTML (template)", body: visual.corpoHtmlRaw, variant: "code" });
      }
    }
    if (data.placeholders) {
      sections.push({
        title: "Variáveis disponíveis",
        body: formatList(data.placeholders),
        variant: "muted",
      });
    }
    sections.push({
      title: "Automação",
      body: "Payload send-nf-email → n8n monta o e-mail Resend/Gmail com estes campos.",
      variant: "muted",
    });
    return sections;
  }

  if (input.tipo === "nota_fiscal") {
    return [
      { title: "Destinatário (regra)", body: String(data.destinatario ?? "—") },
      { title: "Campos na discriminação", body: formatList(data.corpo), variant: "muted" },
      {
        title: "Automação",
        body: "Texto montado em emit-nf / focus-nfe.ts na emissão Focus NFE.",
        variant: "muted",
      },
    ];
  }

  if (input.tipo === "relatorio_atendimento") {
    return [
      { title: "Variáveis vinculadas", body: formatList(data.placeholders), variant: "muted" },
      {
        title: "Layout PDF",
        body: "Visual definido em pdf-grade-v2 (código). Este registro versiona metadados RQ.GPS.09.*.",
        variant: "muted",
      },
    ];
  }

  return [{ title: "Conteúdo (JSON)", body: JSON.stringify(data, null, 2), variant: "code" }];
}

export function wrapEmailPreviewDocument(bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>
body{font-family:Segoe UI,system-ui,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a;margin:0;padding:20px;background:#fff;}
a{color:#0e7490;text-decoration:underline;}
ul{padding-left:1.25rem;}
li{margin:0.35rem 0;}
strong{font-weight:600;}
</style></head><body>${bodyHtml}</body></html>`;
}
