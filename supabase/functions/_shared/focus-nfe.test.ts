import {
  buildFocusNfsenPayload,
  formatDiasAtendidos,
  tipoSessaoDeTexto,
  verifyFocusWebhookSecret,
  FISIOTERAPIA_CODIGO_NBS,
  FISIOTERAPIA_CODIGO_TRIBUTACAO,
  POA_CODIGO_MUNICIPIO,
  type FocusNfeConfig,
  type NfForFocus,
} from "./focus-nfe.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseConfig: FocusNfeConfig = {
  token: "test",
  ambiente: "homologacao",
  cnpjPrestador: "42082795000174",
  codigoMunicipio: POA_CODIGO_MUNICIPIO,
  codigoTributacao: FISIOTERAPIA_CODIGO_TRIBUTACAO,
  codigoNbs: FISIOTERAPIA_CODIGO_NBS,
  // POA CNC NFS-e rejeita IM (E0120) — omitir por padrão
  codigoOpcaoSimplesNacional: 3,
  regimeTributarioSimplesNacional: 1,
  percentualTotalTributosSimples: 6,
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

Deno.test("particular omite IM (POA) e inclui e-mail tomador", () => {
  const payload = buildFocusNfsenPayload(
    {
      ...baseNf,
      tomador: { email: "pavan.amandaa@gmail.com", telefone: "51999999999" },
    },
    baseConfig,
  );

  if ("inscricao_municipal_prestador" in payload) {
    throw new Error("POA não deve enviar IM do prestador");
  }
  if (payload.cpf_tomador !== "03555110020") throw new Error("CPF tomador incorreto");
  if (payload.email_tomador !== "pavan.amandaa@gmail.com") {
    throw new Error("e-mail tomador ausente");
  }
  if (payload.codigo_municipio_tomador !== String(POA_CODIGO_MUNICIPIO)) {
    throw new Error("CPF deve enviar codigo_municipio_tomador POA");
  }
  if (payload.codigo_opcao_simples_nacional !== 3) {
    throw new Error("Simples ME/EPP esperado");
  }
  if (payload.regime_tributario_simples_nacional !== 1) {
    throw new Error("regime_tributario_simples_nacional obrigatório para ME/EPP");
  }
  if (payload.percentual_total_tributos_simples_nacional !== 6) {
    throw new Error("percentual_total_tributos_simples_nacional obrigatório para ME/EPP");
  }
});

Deno.test("IM só entra no payload quando configurada", () => {
  const payload = buildFocusNfsenPayload(baseNf, {
    ...baseConfig,
    inscricaoMunicipal: "1477199",
  });
  if (payload.inscricao_municipal_prestador !== "1477199") {
    throw new Error("IM configurada deveria ir no payload");
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

Deno.test("descricao particular segue padrao DANFSe 2085", () => {
  const payload = buildFocusNfsenPayload(
    {
      ...baseNf,
      competencia_mes: 4,
      competencia_ano: 2026,
      corpo_dias_atendidos: "02, 06, 09, 13, 16, 20, 23, 27 E 30",
      corpo_total_sessoes: 9,
      fisio_nome: "DRA. CHARLENE BRITO",
      fisio_crefito: "122334-F",
      tomador: { email: "pavan.amandaa@gmail.com" },
    },
    baseConfig,
  );
  const desc = String(payload.descricao_servico ?? "");
  if (!desc.includes("ABRIL DE 2026")) throw new Error(`mes ausente: ${desc}`);
  if (!desc.includes("02, 06, 09, 13, 16, 20, 23, 27 E 30"))
    throw new Error(`dias ausentes: ${desc}`);
  if (!desc.includes("TOTALIZANDO 09 SESSÕES")) throw new Error(`total ausente: ${desc}`);
  if (!desc.includes("CREFITO: 122 334-F")) throw new Error(`crefito ausente: ${desc}`);
  if (!desc.includes("REFERENTE ÀS SESSÕES")) throw new Error(`acento ÀS ausente: ${desc}`);
});

Deno.test("formatDiasAtendidos formata lista CB MOVE", () => {
  if (formatDiasAtendidos([]) !== "") throw new Error("vazio");
  if (formatDiasAtendidos([16]) !== "16") throw new Error("um dia");
  if (formatDiasAtendidos([2, 6, 9, 13]) !== "02, 06, 09 E 13") throw new Error("varios dias");
  if (formatDiasAtendidos([9, 2, 2, 6]) !== "02, 06 E 09") throw new Error("dedup e sort");
});

Deno.test("tipoSessaoDeTexto evita falso positivo em 2x semana", () => {
  if (tipoSessaoDeTexto("2x semana triplo") !== "triplo") throw new Error("triplo");
  if (tipoSessaoDeTexto("2x semana duplo") !== "duplo") throw new Error("duplo");
  if (tipoSessaoDeTexto("2x semana") !== "simples") throw new Error("simples sem duplo/triplo");
  if (tipoSessaoDeTexto("quadruplo") !== "quadruplo") throw new Error("quadruplo");
  if (tipoSessaoDeTexto(null) !== "simples") throw new Error("null");
});

Deno.test("verifyFocusWebhookSecret fail-closed sem secret", async () => {
  const prev = Deno.env.get("FOCUSNFE_WEBHOOK_SECRET");
  Deno.env.delete("FOCUSNFE_WEBHOOK_SECRET");

  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  try {
    const req = new Request("https://example.com/webhook");
    const ok = await verifyFocusWebhookSecret(admin, req);
    if (ok) throw new Error("deveria rejeitar quando FOCUSNFE_WEBHOOK_SECRET ausente");
  } finally {
    if (prev) Deno.env.set("FOCUSNFE_WEBHOOK_SECRET", prev);
  }
});
