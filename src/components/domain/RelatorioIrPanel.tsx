import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { DashboardSectionBadge } from "@/components/domain/DashboardSection";
import { brl, formatDate } from "@/lib/format";
import {
  downloadPdfBase64,
  fetchNotasIrPacienteAno,
  gerarRelatorioIrPdf,
} from "@/lib/queries/relatorio-ir";
import { fetchPacientes } from "@/lib/queries/pacientes";

const ANO_ATUAL = new Date().getFullYear();
const ANOS = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2, ANO_ATUAL - 3];

export function RelatorioIrPanel() {
  const [pacienteId, setPacienteId] = React.useState<string>("");
  const [ano, setAno] = React.useState(String(ANO_ATUAL));
  const [exportando, setExportando] = React.useState(false);

  const pacientesQuery = useQuery({
    queryKey: ["pacientes", "ir-select"],
    queryFn: () => fetchPacientes({ ativo: true }),
  });

  const anoNum = Number(ano);
  const nfsQuery = useQuery({
    queryKey: ["notas-fiscais", "ir", pacienteId, anoNum],
    queryFn: () => fetchNotasIrPacienteAno(pacienteId, anoNum),
    enabled: Boolean(pacienteId) && Number.isFinite(anoNum),
  });

  const nfs = nfsQuery.data ?? [];
  const total = nfs.reduce((s, n) => s + (Number(n.valor) || 0), 0);
  const pacientes = (pacientesQuery.data ?? [])
    .slice()
    .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR"));

  async function exportarPdf() {
    if (!pacienteId) {
      toast.error("Selecione um paciente");
      return;
    }
    setExportando(true);
    try {
      const result = await gerarRelatorioIrPdf(pacienteId, anoNum);
      downloadPdfBase64(result.pdf_base64, result.filename);
      toast.success(
        result.qtd_notas > 0
          ? `PDF de IR ${anoNum} baixado (${result.qtd_notas} NF${result.qtd_notas > 1 ? "s" : ""})`
          : `PDF de IR ${anoNum} baixado (sem NFs emitidas)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF de IR");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="cb-glass-card overflow-hidden">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap flex-1 gap-3">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label>Paciente</Label>
              <Select value={pacienteId || undefined} onValueChange={setPacienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {pacientes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[120px] space-y-1.5">
              <Label>Ano</Label>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANOS.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pacienteId ? (
              <DashboardSectionBadge accent="purple">{brl(total)}</DashboardSectionBadge>
            ) : null}
            <Button
              size="sm"
              onClick={() => void exportarPdf()}
              disabled={!pacienteId || exportando}
            >
              <Download className="mr-1 h-4 w-4" />
              {exportando ? "Gerando…" : "Exportar PDF"}
            </Button>
          </div>
        </div>

        {!pacienteId ? (
          <EmptyState
            title="Selecione um paciente"
            description="A lista mostra NFs emitidas no ano escolhido."
          />
        ) : nfsQuery.isPending ? (
          <LoadingState />
        ) : nfs.length === 0 ? (
          <EmptyState
            title="Nenhuma NF emitida neste ano"
            description="Só entram notas com status emitida."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nfs.map((nf) => (
                <TableRow key={nf.id}>
                  <TableCell className="font-medium">{nf.numero ?? "—"}</TableCell>
                  <TableCell>{formatDate(nf.emissao)}</TableCell>
                  <TableCell>{nf.destinatario_nome ?? "—"}</TableCell>
                  <TableCell className="capitalize">{nf.status ?? "—"}</TableCell>
                  <TableCell className="text-right">{brl(Number(nf.valor) || 0)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">{brl(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
