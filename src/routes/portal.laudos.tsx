import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/domain/LoadingState";
import { Button } from "@/components/ui/button";

export const Route = (createFileRoute as any)("/portal/laudos")({
  component: PortalLaudos,
});

type Relatorio = {
  id: string;
  created_at: string;
  pdf_url: string | null;
};

function PortalLaudos() {
  const { pacienteId } = useAuth();
  const [docs, setDocs] = React.useState<Relatorio[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!pacienteId) return;
    (supabase as any)
      .from("relatorios_atendimento")
      .select("id, created_at, pdf_url")
      .eq("paciente_id", pacienteId)
      .eq("status", "assinado")
      .order("created_at", { ascending: false })
      .then(({ data }: { data: Relatorio[] | null }) => {
        setDocs(data ?? []);
        setLoading(false);
      });
  }, [pacienteId]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Seus documentos e laudos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Relatórios assinados pela sua fisioterapeuta
        </p>
      </div>

      {docs.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum documento disponível ainda.
        </p>
      )}

      {docs.length > 0 && (
        <ul className="space-y-3">
          {docs.map((doc) => {
            const mes = new Date(doc.created_at).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            });
            return (
              <li key={doc.id} className="flex items-center justify-between rounded-xl border bg-white px-4 py-4 shadow-sm">
                <div>
                  <p className="text-sm font-semibold capitalize text-foreground">
                    Relatório de {mes}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">PDF assinado</p>
                </div>
                {doc.pdf_url ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={doc.pdf_url} target="_blank" rel="noopener noreferrer">
                      Baixar
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Indisponível</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
