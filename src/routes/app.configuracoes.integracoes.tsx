import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/configuracoes/integracoes")({
  head: () => ({ meta: [{ title: "Integrações · CB MOVE" }] }),
  component: IntegracoesPage,
});

const INTEGRACOES = [
  {
    id: "cora",
    nome: "Cora",
    categoria: "Financeiro",
    descricao:
      "Geração de boleto e PIX (Integração Direta mTLS). Envio ao paciente é feito pelo n8n.",
    status: "Configurar credenciais mTLS",
    secrets: "CORA_CLIENT_ID, CORA_CERTIFICATE, CORA_PRIVATE_KEY, CORA_API_BASE",
  },
  {
    id: "focus-nfe",
    nome: "Focus NFe",
    categoria: "Fiscal",
    descricao:
      "NFS-e Nacional POA — empresa cadastrada (ID 230418). Certificado A1 carregado; ambiente em homologação (pendente virar produção).",
    status: "Homologação",
    secrets: "FOCUSNFE_TOKEN, FOCUSNFE_CNPJ_PRESTADOR, FOCUSNFE_AMBIENTE",
  },
  {
    id: "n8n",
    nome: "n8n",
    categoria: "Automação",
    descricao: "Envio de documentos ao paciente: NF por e-mail e boleto por e-mail + WhatsApp.",
    status: "NF ativo · Boleto em implantação",
    secrets: "N8N_WEBHOOK_NF_EMAIL, N8N_WEBHOOK_BOLETO_DOCS, N8N_WEBHOOK_SECRET",
  },
  {
    id: "bradesco",
    nome: "Bradesco",
    categoria: "Financeiro",
    descricao: "Conciliação por import de extratos CSV/OFX.",
    status: "Ativo (parser client)",
    secrets: "—",
  },
];

function IntegracoesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure as integrações externas do sistema CB MOVE.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRACOES.map((integ) => (
          <div
            key={integ.id}
            className="rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-foreground">{integ.nome}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{integ.categoria}</p>
              </div>
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border-border">
                {integ.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground flex-1">{integ.descricao}</p>
            <p className="text-xs text-muted-foreground font-mono">{integ.secrets}</p>
            {integ.id === "n8n" && (
              <p className="text-xs text-muted-foreground">
                NF → send-nf-email → n8n · Boleto → send-boleto-cobranca → n8n (e-mail + WhatsApp)
              </p>
            )}
            {integ.id === "cora" && (
              <p className="text-xs text-muted-foreground">
                Gerar boleto na UI chama emit-boleto-cora (mTLS). Enviar boleto dispara n8n após
                geração.
              </p>
            )}
            {integ.id === "focus-nfe" && (
              <p className="text-xs text-muted-foreground">Ver docs/SETUP_FOCUS_NFE.md</p>
            )}
            <Button variant="outline" size="sm" disabled className="w-full">
              Configurar
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Credenciais configuradas via variáveis de ambiente do servidor. Workflow n8n:{" "}
          <code className="text-xs">docs/n8n/workflow_nf_email.json</code>
        </p>
      </div>
    </div>
  );
}
