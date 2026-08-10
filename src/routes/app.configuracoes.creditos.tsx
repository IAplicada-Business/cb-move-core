import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/brand/PageHeader";
import { DashboardPage, DashboardSection } from "@/components/domain/DashboardSection";
import { LoadingState } from "@/components/domain/LoadingState";
import { EmptyState } from "@/components/domain/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/app/configuracoes/creditos")({
  head: () => ({ meta: [{ title: "Créditos IA · CB MOVE" }] }),
  component: CreditosIAPage,
});

type CreditoUso = {
  id: string;
  tipo: string;
  tokens_entrada: number;
  tokens_saida: number;
  custo_estimado_usd: number | null;
  created_at: string;
};

const TIPO_LABEL: Record<string, string> = {
  estruturacao_soap: "Estruturação S/O/P",
  transcricao_audio: "Transcrição áudio",
};

function brlUsd(v: number | null) {
  if (v == null) return "—";
  return `US$ ${v.toFixed(4)}`;
}

function CreditosIAPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const { data, isLoading } = useQuery({
    queryKey: ["creditos_ia_uso"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("creditos_ia_uso")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as CreditoUso[];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <DashboardPage>
        <PageHeader
          crumbs={[
            { label: "Sistema" },
            { label: "Configurações", to: "/app/configuracoes" },
            { label: "Créditos IA" },
          ]}
          title="Créditos IA"
          description="Consumo de tokens Anthropic Claude (admin)."
        />
        <EmptyState
          title="Acesso restrito"
          description="Apenas administradores podem ver o uso de IA."
        />
      </DashboardPage>
    );
  }

  const totalUsd = (data ?? []).reduce((s, c) => s + Number(c.custo_estimado_usd ?? 0), 0);
  const totalTokens = (data ?? []).reduce((s, c) => s + (c.tokens_entrada + c.tokens_saida), 0);

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[
          { label: "Sistema" },
          { label: "Configurações", to: "/app/configuracoes" },
          { label: "Créditos IA" },
        ]}
        title="Créditos IA"
        description="Consumo de tokens Anthropic Claude para estruturação S/O/P."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Chamadas totais
          </p>
          <p className="text-2xl font-bold text-foreground">{(data ?? []).length}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tokens totais
          </p>
          <p className="text-2xl font-bold text-foreground">
            {totalTokens.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Custo estimado
          </p>
          <p className="text-2xl font-bold text-foreground">US$ {totalUsd.toFixed(4)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Haiku: $0,25/MTok in · $1,25/MTok out
          </p>
        </div>
      </div>

      <DashboardSection
        eyebrow="Inteligência artificial"
        accent="purple"
        title="Histórico de uso"
        noPadding
      >
        {isLoading ? (
          <div className="p-5">
            <LoadingState />
          </div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Sem registros"
              description="O uso aparece aqui quando a ANTHROPIC_API_KEY estiver configurada e evoluções forem estruturadas."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Tokens entrada</TableHead>
                <TableHead className="text-right">Tokens saída</TableHead>
                <TableHead className="text-right">Custo est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm">{fmtDate(c.created_at)}</TableCell>
                  <TableCell className="text-sm">{TIPO_LABEL[c.tipo] ?? c.tipo}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {c.tokens_entrada.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {c.tokens_saida.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {brlUsd(c.custo_estimado_usd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DashboardSection>
    </DashboardPage>
  );
}
