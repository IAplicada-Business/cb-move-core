import { describe, expect, it } from "vitest";

import {
  categoriasTemplatesVisiveis,
  categoriaDoTemplate,
  filtrarTemplatesPorCategoria,
} from "./templates-versionados";

const templates = [
  { id: "1", tipo: "nota_fiscal" },
  { id: "2", tipo: "email_nf" },
  { id: "3", tipo: "relatorio_atendimento" },
  { id: "4", tipo: "legado_custom" },
];

describe("templates-versionados", () => {
  it("mapeia categorias conhecidas", () => {
    expect(categoriaDoTemplate("nota_fiscal")).toBe("nota_fiscal");
    expect(categoriaDoTemplate("email_nf")).toBe("email_nf");
    expect(categoriaDoTemplate("relatorio_atendimento")).toBe("relatorio_atendimento");
    expect(categoriaDoTemplate("legado_custom")).toBe("outros");
  });

  it("filtra por categoria", () => {
    expect(filtrarTemplatesPorCategoria(templates, "nota_fiscal")).toHaveLength(1);
    expect(filtrarTemplatesPorCategoria(templates, "outros")).toEqual([templates[3]]);
  });

  it("exibe aba outros apenas quando há tipos órfãos", () => {
    expect(categoriasTemplatesVisiveis(templates.slice(0, 3))).toEqual([
      "nota_fiscal",
      "email_nf",
      "relatorio_atendimento",
    ]);
    expect(categoriasTemplatesVisiveis(templates)).toContain("outros");
  });
});
