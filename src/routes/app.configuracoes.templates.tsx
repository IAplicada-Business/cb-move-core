import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/configuracoes/templates")({
  head: () => ({ meta: [{ title: "Templates · CB MOVE" }] }),
  component: TemplatesPage,
});

// ─── types ───────────────────────────────────────────────────────────────────

type Template = {
  id: string;
  codigo: string;
  tipo: string;
  modelo: string | null;
  versao: number;
  ativo: boolean;
  created_at: string;
  conteudo: unknown;
};

// ─── queries ─────────────────────────────────────────────────────────────────

async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from("templates_versionados")
    .select("*")
    .order("tipo")
    .order("versao", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Template[];
}

// ─── page ────────────────────────────────────────────────────────────────────

function TemplatesPage() {
  const [preview, setPreview] = useState<Template | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: queryKeys.templates.all,
    queryFn: fetchTemplates,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Templates NF</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Templates versionados para emissão de notas fiscais</p>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Nenhum template encontrado"
          description="Nenhum template versionado cadastrado no sistema."
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.codigo}</TableCell>
                  <TableCell className="text-sm">{t.tipo}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.modelo ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      v{t.versao}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                      t.ativo
                        ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {t.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPreview(t)}
                    >
                      Visualizar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template: {preview?.codigo} v{preview?.versao}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(preview?.conteudo, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
