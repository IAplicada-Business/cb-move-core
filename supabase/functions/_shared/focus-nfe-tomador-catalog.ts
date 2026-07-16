import type { TomadorForFocus } from "./focus-nfe.ts";

/** Cadastro fiscal dos tomadores (docs/docs2). Fallback até convenios.* no banco. */
export type TomadorCatalogEntry = TomadorForFocus & {
  razao_social: string;
};


/** Cadastro fiscal de tomadores pessoa fisica (NF particular) — fallback ate pacientes.endereco*. */
export const TOMADOR_CATALOG_BY_CPF: Record<string, TomadorCatalogEntry> = {
  "03555110020": {
    razao_social: "AMANDA PAVAN",
    email: "pavan.amandaa@gmail.com",
    telefone: "51992436874",
    endereco: "Rua Irmão Norberto Francisco Rauch",
    numero: "700",
    complemento: "Torre C | Apto 518",
    bairro: "Jardim Carvalho",
    cep: "91450147",
    cidade: "Porto Alegre",
    uf: "RS",
    codigo_municipio_ibge: 4314902,
  },
};

// Nota (2026-07-16): `numero` é separado explicitamente do `endereco` porque o schema da NFS-e
// Nacional exige o número do imóvel como elemento próprio (`nro`) — não pode ficar embutido no
// texto do logradouro, senão a Focus rejeita a emissão (422 "Missing child element(s) nro").
export const TOMADOR_CATALOG_BY_CNPJ: Record<string, TomadorCatalogEntry> = {
  "92693118000160": {
    razao_social: "BRADESCO SAUDE S/A",
    email: "liminarprestador@bradescoseguros.com.br",
    endereco: "AV RIO DE JANEIRO",
    numero: "555",
    complemento: "SAL 801-SAL 1701",
    bairro: "CAJU",
    cep: "20931675",
    cidade: "Rio de Janeiro",
    uf: "RJ",
    codigo_municipio_ibge: 3304557,
  },
  "00773639000100": {
    razao_social: "CENTRO CLINICO GAUCHO LTDA",
    email: "extra.folha@ccgrs.com.br",
    endereco: "AV HERACLITO GRACA",
    numero: "406",
    bairro: "CENTRO",
    cep: "60140060",
    cidade: "Fortaleza",
    uf: "CE",
    codigo_municipio_ibge: 2304400,
  },
  "87096616000196": {
    razao_social: "UNIMED PORTO ALEGRE - COOPERATIVA MEDICA LTDA",
    endereco: "AV VENANCIO AIRES",
    numero: "1040",
    bairro: "FARROUPILHA",
    cep: "90040192",
    cidade: "Porto Alegre",
    uf: "RS",
    codigo_municipio_ibge: 4314902,
  },
  "03658432001820": {
    razao_social: "GEAP AUTOGESTAO EM SAUDE",
    endereco: "R LUCIANA DE ABREU",
    numero: "416",
    bairro: "MOINHOS DE VENTO",
    cep: "90570060",
    cidade: "Porto Alegre",
    uf: "RS",
    codigo_municipio_ibge: 4314902,
  },
  "30483455000176": {
    razao_social: "INSTITUTO ASSISTENCIA A SAUDE DOS SERVIDORES PUBLICOS DO RS",
    endereco: "AV BORGES DE MEDEIROS",
    numero: "1945",
    bairro: "PRAIA DE BELAS",
    cep: "90110900",
    cidade: "Porto Alegre",
    uf: "RS",
    codigo_municipio_ibge: 4314902,
  },
  "27578434000120": {
    razao_social: "UNIMED VITORIA COOPERATIVA DE TRABALHO MEDICO",
    email: "pagamentoscoinr@unimedvx.com.br",
    endereco: "AV CEZAR HILAL",
    numero: "700",
    bairro: "BENTO FERREIRA",
    cep: "29050903",
    cidade: "Vitoria",
    uf: "ES",
    codigo_municipio_ibge: 3205309,
  },
  "01387625000110": {
    razao_social: "DOCTOR CLIN OPERADORA DE PLANOS DE SAUDE LTDA",
    email: "cintia.skonetzky@doctorclin.com.br",
    endereco: "R SETE DE SETEMBRO",
    numero: "769",
    complemento: "ANDAR 10",
    bairro: "CENTRO HISTORICO",
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
  fromPaciente?: TomadorForFocus,
): TomadorForFocus | undefined {
  const doc = onlyDigits(documento);
  const catalog = doc.length === 14
    ? TOMADOR_CATALOG_BY_CNPJ[doc]
    : doc.length === 11
    ? TOMADOR_CATALOG_BY_CPF[doc]
    : undefined;

  if (!catalog && !fromDb && !fromPaciente) return undefined;

  return {
    email: fromDb?.email ?? fromPaciente?.email ?? catalog?.email,
    telefone: fromDb?.telefone ?? fromPaciente?.telefone ?? catalog?.telefone,
    endereco: fromDb?.endereco ?? fromPaciente?.endereco ?? catalog?.endereco,
    numero: fromDb?.numero ?? fromPaciente?.numero ?? catalog?.numero,
    complemento: fromDb?.complemento ?? fromPaciente?.complemento ?? catalog?.complemento,
    bairro: fromDb?.bairro ?? fromPaciente?.bairro ?? catalog?.bairro,
    cep: fromDb?.cep ?? fromPaciente?.cep ?? catalog?.cep,
    cidade: fromDb?.cidade ?? fromPaciente?.cidade ?? catalog?.cidade,
    uf: fromDb?.uf ?? fromPaciente?.uf ?? catalog?.uf,
    codigo_municipio_ibge:
      fromDb?.codigo_municipio_ibge ??
      fromPaciente?.codigo_municipio_ibge ??
      catalog?.codigo_municipio_ibge,
  };
}
