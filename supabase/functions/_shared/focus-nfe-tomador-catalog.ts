import type { TomadorForFocus } from "./focus-nfe.ts";

/** Cadastro fiscal dos tomadores (docs/docs2). Fallback até convenios.* no banco. */
export type TomadorCatalogEntry = TomadorForFocus & {
  razao_social: string;
};

export const TOMADOR_CATALOG_BY_CNPJ: Record<string, TomadorCatalogEntry> = {
  "92693118000160": {
    razao_social: "BRADESCO SAUDE S/A",
    email: "liminarprestador@bradescoseguros.com.br",
    endereco: "AV RIO DE JANEIRO, 555, SAL 801-SAL 1701, CAJU",
    cep: "20931675",
    cidade: "Rio de Janeiro",
    uf: "RJ",
    codigo_municipio_ibge: 3304557,
  },
  "00773639000100": {
    razao_social: "CENTRO CLINICO GAUCHO LTDA",
    email: "extra.folha@ccgrs.com.br",
    endereco: "AV HERACLITO GRACA, 406, CENTRO",
    cep: "60140060",
    cidade: "Fortaleza",
    uf: "CE",
    codigo_municipio_ibge: 2304400,
  },
  "87096616000196": {
    razao_social: "UNIMED PORTO ALEGRE - COOPERATIVA MEDICA LTDA",
    endereco: "AV VENANCIO AIRES, 1040, FARROUPILHA",
    cep: "90040192",
    cidade: "Porto Alegre",
    uf: "RS",
    codigo_municipio_ibge: 4314902,
  },
  "03658432001820": {
    razao_social: "GEAP AUTOGESTAO EM SAUDE",
    endereco: "R LUCIANA DE ABREU, 416, MOINHOS DE VENTO",
    cep: "90570060",
    cidade: "Porto Alegre",
    uf: "RS",
    codigo_municipio_ibge: 4314902,
  },
  "30483455000176": {
    razao_social: "INSTITUTO ASSISTENCIA A SAUDE DOS SERVIDORES PUBLICOS DO RS",
    endereco: "AV BORGES DE MEDEIROS, 1945, PRAIA DE BELAS",
    cep: "90110900",
    cidade: "Porto Alegre",
    uf: "RS",
    codigo_municipio_ibge: 4314902,
  },
  "27578434000120": {
    razao_social: "UNIMED VITORIA COOPERATIVA DE TRABALHO MEDICO",
    email: "pagamentoscoinr@unimedvx.com.br",
    endereco: "AV CEZAR HILAL, 700, BENTO FERREIRA",
    cep: "29050903",
    cidade: "Vitoria",
    uf: "ES",
    codigo_municipio_ibge: 3205309,
  },
  "01387625000110": {
    razao_social: "DOCTOR CLIN OPERADORA DE PLANOS DE SAUDE LTDA",
    email: "cintia.skonetzky@doctorclin.com.br",
    endereco: "R SETE DE SETEMBRO, 769, ANDAR 10, CENTRO HISTORICO",
    cep: "90010190",
    cidade: "Porto Alegre",
    uf: "RS",
    codigo_municipio_ibge: 4314902,
  },
};

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function mergeTomador(
  documento: string | null | undefined,
  fromDb: TomadorForFocus | undefined,
  fromPaciente?: Pick<TomadorForFocus, "email" | "telefone">,
): TomadorForFocus | undefined {
  const doc = onlyDigits(documento);
  const catalog = doc.length === 14 ? TOMADOR_CATALOG_BY_CNPJ[doc] : undefined;

  if (!catalog && !fromDb && !fromPaciente) return undefined;

  return {
    email: fromDb?.email ?? fromPaciente?.email ?? catalog?.email,
    telefone: fromDb?.telefone ?? fromPaciente?.telefone ?? catalog?.telefone,
    endereco: fromDb?.endereco ?? catalog?.endereco,
    cep: fromDb?.cep ?? catalog?.cep,
    cidade: fromDb?.cidade ?? catalog?.cidade,
    uf: fromDb?.uf ?? catalog?.uf,
    codigo_municipio_ibge: fromDb?.codigo_municipio_ibge ?? catalog?.codigo_municipio_ibge,
  };
}
