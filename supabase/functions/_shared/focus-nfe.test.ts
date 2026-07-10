import {
  buildFocusNfsenPayload,
  FISIOTERAPIA_CODIGO_NBS,
  FISIOTERAPIA_CODIGO_TRIBUTACAO,
  POA_CODIGO_MUNICIPIO,
  type FocusNfeConfig,
  type NfForFocus,
} from "./focus-nfe.ts";

const baseConfig: FocusNfeConfig = {
  token: "test",
  ambiente: "homologacao",
  cnpjPrestador: "42082795000174",
  codigoMunicipio: POA_CODIGO_MUNICIPIO,
  codigoTributacao: FISIOTERAPIA_CODIGO_TRIBUTACAO,
  codigoNbs: FISIOTERAPIA_CODIGO_NBS,
  inscricaoMunicipal: "1477199",
  codigoOpcaoSimplesNacional: 1,
};

const baseNf: NfForFocus = {
  id: "test-nf",
  tipo: "particular",
  valor: 150,
  competencia_mes: 6,
  competencia_ano: 2026,
  destinatario_nome: "Amanda Pavan",
  destinatario_documento: "03555110020",
  corpo_paciente_nome: "Amanda Pavan",
  corpo_paciente_cpf: "035.551.100-20",
  corpo_numero_processo: null,
  corpo_total_sessoes: null,
};

Deno.test("particular inclui IM prestador e e-mail tomador", () => {
  const payload = buildFocusNfsenPayload(
    {
      ...baseNf,
      tomador: { email: "pavan.amandaa@gmail.com", telefone: "51999999999" },
    },
    baseConfig,
  );

  if (payload.inscricao_municipal_prestador !== "1477199") {
    throw new Error("IM prestador ausente");
  }
  if (payload.cpf_tomador !== "03555110020") throw new Error("CPF tomador incorreto");
  if (payload.email_tomador !== "pavan.amandaa@gmail.com") {
    throw new Error("e-mail tomador ausente");
  }
  if ("codigo_municipio_tomador" in payload) {
    throw new Error("CPF não deve enviar codigo_municipio_tomador");
  }
});

Deno.test("judicial Bradesco usa município RJ do tomador", () => {
  const payload = buildFocusNfsenPayload(
    {
      ...baseNf,
      tipo: "judicial",
      destinatario_nome: "BRADESCO SAUDE S/A",
      destinatario_documento: "92693118000160",
      tomador: {
        email: "liminarprestador@bradescoseguros.com.br",
        endereco: "AV RIO DE JANEIRO, 555, CAJU",
        cep: "20931675",
        uf: "RJ",
        codigo_municipio_ibge: 3304557,
      },
    },
    baseConfig,
  );

  if (payload.cnpj_tomador !== "92693118000160") throw new Error("CNPJ tomador incorreto");
  if (payload.codigo_municipio_tomador !== "3304557") {
    throw new Error(`município tomador incorreto: ${payload.codigo_municipio_tomador}`);
  }
  if (payload.uf_tomador !== "RJ") throw new Error("UF tomador incorreta");
  if (payload.cep_tomador !== "20931675") throw new Error("CEP tomador incorreto");
});

Deno.test("convenio sem tomador cai no município POA", () => {
  const payload = buildFocusNfsenPayload(
    {
      ...baseNf,
      tipo: "convenio",
      destinatario_nome: "UNIMED PORTO ALEGRE",
      destinatario_documento: "87096616000196",
    },
    baseConfig,
  );

  if (payload.codigo_municipio_tomador !== String(POA_CODIGO_MUNICIPIO)) {
    throw new Error("fallback POA não aplicado");
  }
});
