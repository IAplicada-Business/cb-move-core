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

/** Monta preview legível por categoria de template. */
export function buildTemplatePreviewSections(
  input: TemplatePreviewInput,
): TemplatePreviewSection[] {
  const data = asRecord(input.conteudo);
  if (!data) {
    return [{ title: "Conteúdo", body: "Sem conteúdo cadastrado.", variant: "warning" }];
  }

  if (input.tipo === "email_nf") {
    const assunto = String(data.assunto ?? "—");
    const corpo = data.corpo_html ?? data.corpo ?? "—";
    const corpoStr = String(corpo);
    const sections: TemplatePreviewSection[] = [
      { title: "Assunto", body: assunto },
      {
        title: "Corpo do e-mail",
        body: corpoStr,
        variant: corpoStr === "placeholder" ? "warning" : "code",
      },
    ];
    if (data.placeholders) {
      sections.push({
        title: "Variáveis disponíveis",
        body: formatList(data.placeholders),
        variant: "muted",
      });
    }
    if (corpoStr === "placeholder") {
      sections.push({
        title: "Status",
        body: "Corpo ainda não configurado — o fluxo n8n/send-nf-email usará rascunho até atualizar este template.",
        variant: "warning",
      });
    }
    sections.push({
      title: "Uso no sistema",
      body: "A Edge Function envia assunto_sugerido no payload; o n8n aplica este template (assunto/corpo) ao montar o e-mail Resend/Gmail.",
      variant: "muted",
    });
    return sections;
  }

  if (input.tipo === "nota_fiscal") {
    return [
      {
        title: "Destinatário na NF",
        body: String(data.destinatario ?? "—"),
      },
      {
        title: "Campos no corpo da discriminação",
        body: formatList(data.corpo),
        variant: "muted",
      },
      {
        title: "Uso no sistema",
        body: "Metadados para emissão Focus NFE — o texto da discriminação é montado em emit-nf/focus-nfe.ts.",
        variant: "muted",
      },
    ];
  }

  if (input.tipo === "relatorio_atendimento") {
    return [
      {
        title: "Variáveis vinculadas",
        body: formatList(data.placeholders),
        variant: "muted",
      },
      {
        title: "Uso no sistema",
        body: "Registro de versão RQ.GPS.09.* associado à geração mensal. O layout visual do PDF é definido em pdf-grade-v2 (código), não por este JSON.",
        variant: "muted",
      },
    ];
  }

  return [
    {
      title: "Conteúdo (JSON)",
      body: JSON.stringify(data, null, 2),
      variant: "code",
    },
  ];
}
