import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/configuracoes/integracoes")({
  head: () => ({ meta: [{ title: "Integrações · CB MOVE" }] }),
  component: IntegracoesPage,
});

// ─── static integration cards ────────────────────────────────────────────────

const INTEGRACOES = [
  {
    id: "cora",
    nome: "Cora",
    descricao: "Emissão e gestão de boletos bancários.",
    categoria: "Financeiro",
  },
  {
    id: "safe-notas",
    nome: "Safe Notas",
    descricao: "Emissão automática de notas fiscais de serviços (NFS-e).",
    categoria: "Fiscal",
  },
  {
    id: "resend",
    nome: "Resend",
    descricao: "Envio transacional de e-mails (cobranças, NFs, relatórios).",
    categoria: "Comunicação",
  },
];

// ─── page ─────────────────────────────────────────────────────────────────────

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
                Aguardando credenciais
              </span>
            </div>

            <p className="text-sm text-muted-foreground flex-1">{integ.descricao}</p>

            <Button
              variant="outline"
              size="sm"
              disabled
              className="w-full"
            >
              Configurar
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          As credenciais das integrações são configuradas diretamente nas variáveis de ambiente do servidor.
          Entre em contato com o suporte técnico para ativar uma integração.
        </p>
      </div>
    </div>
  );
}
