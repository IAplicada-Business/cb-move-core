import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queries/keys";
import { fetchSessaoSiglaDia } from "@/lib/queries/sessoes";
import {
  fetchSessaoFisioterapeutas,
  setSessaoFisioterapeutas,
} from "@/lib/queries/sessao-fisioterapeutas";
import { fetchFisios } from "@/lib/queries/fisioterapeutas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  pacienteId: string;
  dataIso: string;
  fisioPrincipalId: string | null;
};

export function SessaoMultiFisioEditor({ pacienteId, dataIso, fisioPrincipalId }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<string[]>([]);

  const { data: fisios = [] } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ativos,
    queryFn: () => fetchFisios({ ativosOnly: true }),
  });

  const { data: sessaoId } = useQuery({
    queryKey: queryKeys.sessoes.siglaDia(pacienteId, dataIso),
    queryFn: async () => {
      const sigla = await fetchSessaoSiglaDia(pacienteId, dataIso);
      if (!sigla) return null;
      const { data, error } = await supabase
        .from("sessoes")
        .select("id")
        .eq("paciente_id", pacienteId)
        .eq("data", dataIso)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!pacienteId && !!dataIso,
  });

  const { data: links = [] } = useQuery({
    queryKey: queryKeys.sessaoFisioterapeutas.bySessao(sessaoId ?? ""),
    queryFn: () => fetchSessaoFisioterapeutas(sessaoId!),
    enabled: !!sessaoId,
  });

  React.useEffect(() => {
    if (links.length > 0) {
      setSelected(links.map((l) => l.fisioterapeutaId));
    } else if (fisioPrincipalId) {
      setSelected([fisioPrincipalId]);
    }
  }, [links, fisioPrincipalId]);

  const saveMutation = useMutation({
    mutationFn: () => setSessaoFisioterapeutas(sessaoId!, selected, fisioPrincipalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessaoFisioterapeutas.bySessao(sessaoId!) });
      toast.success("Fisioterapeutas da sessão atualizados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!sessaoId) return null;

  const outros = fisios.filter((f) => f.ativo);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      if (checked) return [...new Set([...prev, id])];
      const next = prev.filter((x) => x !== id);
      if (fisioPrincipalId && !next.includes(fisioPrincipalId)) {
        return [fisioPrincipalId, ...next];
      }
      return next.length > 0 ? next : fisioPrincipalId ? [fisioPrincipalId] : next;
    });
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <Label className="text-xs font-semibold uppercase text-muted-foreground">
        Multi-fisio nesta sessão
      </Label>
      <div className="flex flex-wrap gap-3">
        {outros.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(f.id)}
              onCheckedChange={(v) => toggle(f.id, v === true)}
              disabled={f.id === fisioPrincipalId}
            />
            {f.nome}
            {f.id === fisioPrincipalId ? " (principal)" : ""}
          </label>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? "Salvando…" : "Salvar fisios da sessão"}
      </Button>
    </div>
  );
}
