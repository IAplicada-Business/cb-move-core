export type TemplateVersionadoRef = {
  id: string;
  tipo: string;
};

export type TemplateCategoria = "nota_fiscal" | "email_nf" | "relatorio_atendimento" | "outros";

const CATEGORIAS_CONHECIDAS: TemplateCategoria[] = [
  "nota_fiscal",
  "email_nf",
  "relatorio_atendimento",
];

export const CATEGORIA_META: Record<TemplateCategoria, { label: string; tipos: string[] }> = {
  nota_fiscal: {
    label: "Notas fiscais",
    tipos: ["nota_fiscal"],
  },
  email_nf: {
    label: "E-mails NF",
    tipos: ["email_nf"],
  },
  relatorio_atendimento: {
    label: "Relatórios de atendimento",
    tipos: ["relatorio_atendimento"],
  },
  outros: {
    label: "Outros",
    tipos: [],
  },
};

export const TIPO_LABEL: Record<string, string> = {
  nota_fiscal: "Nota fiscal",
  email_nf: "E-mail NF",
  relatorio_atendimento: "Relatório de atendimento",
};

export const MODELO_LABEL: Record<string, string> = {
  particular: "Particular",
  convenio: "Convênio",
  judicial: "Judicial",
  puc: "PUC",
  convencional: "Convencional",
  unimed: "Unimed",
  sharepoint: "Judicial / SharePoint",
};

const TIPOS_MAPEADOS = new Set(CATEGORIAS_CONHECIDAS.flatMap((cat) => CATEGORIA_META[cat].tipos));

export function categoriaDoTemplate(tipo: string): TemplateCategoria {
  if (tipo === "nota_fiscal") return "nota_fiscal";
  if (tipo === "email_nf") return "email_nf";
  if (tipo === "relatorio_atendimento") return "relatorio_atendimento";
  return "outros";
}

export function filtrarTemplatesPorCategoria<T extends TemplateVersionadoRef>(
  templates: T[],
  categoria: TemplateCategoria,
): T[] {
  if (categoria === "outros") {
    return templates.filter((t) => !TIPOS_MAPEADOS.has(t.tipo));
  }
  const tipos = CATEGORIA_META[categoria].tipos;
  return templates.filter((t) => tipos.includes(t.tipo));
}

/** Abas visíveis: categorias conhecidas + "outros" só se houver registros órfãos. */
export function categoriasTemplatesVisiveis<T extends TemplateVersionadoRef>(
  templates: T[],
): TemplateCategoria[] {
  const visiveis: TemplateCategoria[] = [...CATEGORIAS_CONHECIDAS];
  if (filtrarTemplatesPorCategoria(templates, "outros").length > 0) {
    visiveis.push("outros");
  }
  return visiveis;
}

export const TEMPLATES_PAGE_DESCRICAO =
  "Modelos versionados de NF, e-mail e relatórios (RQ.GPS.*). NF e e-mail utilizam o conteúdo destes registros nos fluxos automatizados. Para relatórios, a versão ativa por modelo é vinculada à geração mensal; o layout visual do PDF é definido no código (pdf-grade-v2), não pelo JSON exibido aqui.";
