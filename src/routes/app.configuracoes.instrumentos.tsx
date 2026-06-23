import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/configuracoes/instrumentos")({
  head: () => ({ meta: [{ title: "Instrumentos clínicos · CB MOVE" }] }),
  component: InstrumentosPage,
});

// ─── types ───────────────────────────────────────────────────────────────────

type Instrumento = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  versao: number;
  status: string;
  created_at: string;
};

// ─── queries ─────────────────────────────────────────────────────────────────

async function fetchInstrumentos(): Promise<Instrumento[]> {
  const { data, error } = await supabase
    .from("instrumentos_clinicos")
    .select("id, codigo, nome, categoria, descricao, versao, status, created_at")
    .order("categoria")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Instrumento[];
}

// ─── page ─────────────────────────────────────────────────────────────────────

function InstrumentosPage() {
  const { data: instrumentos = [], isLoading } = useQuery({
    queryKey: queryKeys.instrumentos.all,
    queryFn: fetchInstrumentos,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Instrumentos clínicos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Catálogo de instrumentos de avaliação neurológica
        </p>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : instrumentos.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-8 w-8" />}
          title="Em breve"
          description="Catálogo de instrumentos de avaliação neurológica — em desenvolvimento."
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instrumentos.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-mono text-xs">{inst.codigo}</TableCell>
                  <TableCell className="font-medium">{inst.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inst.categoria}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      v{inst.versao}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                      inst.status === "ativo"
                        ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {inst.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inst.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-xl border border-dashed bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          O catálogo completo de instrumentos de avaliação neurológica estará disponível em breve.
          Cada instrumento inclui campos personalizados, versão e histórico de aplicações por paciente.
        </p>
      </div>
    </div>
  );
}
