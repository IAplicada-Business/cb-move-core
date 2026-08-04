import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  Plus,
  Trash2,
  Pencil,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries/keys";
import {
  deletePeriodizacaoItem,
  fetchPeriodizacaoPaciente,
  proximoNumeroSessao,
  upsertPeriodizacaoItem,
  type PeriodizacaoSessao,
  type PeriodizacaoStatus,
} from "@/lib/queries/periodizacao";
import {
  removePeriodizacaoPdf,
  uploadPeriodizacaoPdf,
  type Paciente,
} from "@/lib/queries/pacientes";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { fetchFisios } from "@/lib/queries/fisioterapeutas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<PeriodizacaoStatus, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

type Props = {
  pacienteId: string;
  paciente?: Paciente;
  readOnly?: boolean;
  avaliacoesCount?: number;
  onNavigateTab?: (tab: "avaliacoes" | "documentos") => void;
};

function ChecklistItem({
  done,
  label,
  action,
}: {
  done: boolean;
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      {action && <span className="ml-auto shrink-0">{action}</span>}
    </li>
  );
}

export function PacientePeriodizacaoTab({
  pacienteId,
  paciente,
  readOnly,
  avaliacoesCount = 0,
  onNavigateTab,
}: Props) {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canRemovePdf = can.removePeriodizacaoPdf(roles);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PeriodizacaoSessao | null>(null);
  const [numero, setNumero] = React.useState(1);
  const [objetivo, setObjetivo] = React.useState("");
  const [atividades, setAtividades] = React.useState("");
  const [status, setStatus] = React.useState<PeriodizacaoStatus>("planejada");
  const [fisioId, setFisioId] = React.useState("");
  const [driveUrl, setDriveUrl] = React.useState("");
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const periodizacaoPdfUrl = paciente?.periodizacaoPdfUrl ?? null;

  const { data: itens = [], isLoading } = useQuery({
    queryKey: queryKeys.periodizacao.byPaciente(pacienteId),
    queryFn: () => fetchPeriodizacaoPaciente(pacienteId),
    enabled: !!pacienteId,
  });

  const { data: fisios = [] } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ativos,
    queryFn: () => fetchFisios({ ativosOnly: true }),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertPeriodizacaoItem({
        id: editing?.id,
        pacienteId,
        numeroSessao: numero,
        objetivo: objetivo.trim() || null,
        atividadesPrevistas: atividades.trim() || null,
        status,
        fisioterapeutaId: fisioId || null,
        driveDocUrl: driveUrl.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.periodizacao.byPaciente(pacienteId) });
      toast.success(editing ? "Sessão atualizada" : "Sessão adicionada ao plano");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPdfMutation = useMutation({
    mutationFn: () => {
      if (!pdfFile) throw new Error("Selecione um arquivo PDF.");
      return uploadPeriodizacaoPdf(pacienteId, pdfFile);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pacientes.byId(pacienteId) });
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.paciente(pacienteId) });
      setPdfFile(null);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      toast.success("PDF de periodização importado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePdfMutation = useMutation({
    mutationFn: () => removePeriodizacaoPdf(pacienteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pacientes.byId(pacienteId) });
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.paciente(pacienteId) });
      toast.success("PDF de periodização removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePeriodizacaoItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.periodizacao.byPaciente(pacienteId) });
      toast.success("Item removido do plano");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirNovo() {
    setEditing(null);
    setNumero(proximoNumeroSessao(itens));
    setObjetivo("");
    setAtividades("");
    setStatus("planejada");
    setFisioId(paciente?.fisioterapeutaId ?? "");
    setDriveUrl("");
    setDialogOpen(true);
  }

  function abrirEditar(item: PeriodizacaoSessao) {
    setEditing(item);
    setNumero(item.numeroSessao);
    setObjetivo(item.objetivo ?? "");
    setAtividades(item.atividadesPrevistas ?? "");
    setStatus(item.status);
    setFisioId(item.fisioterapeutaId ?? "");
    setDriveUrl(item.driveDocUrl ?? "");
    setDialogOpen(true);
  }

  const semConsultaExperimental = paciente && !paciente.consultaExperimentalEm;
  const temAvaliacao = avaliacoesCount > 0;
  const temFrequencia = Boolean(paciente?.frequenciaAtendimento?.trim());
  const temObjetivos = itens.length > 0;
  const temPdf = Boolean(periodizacaoPdfUrl);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fluxo de periodização
        </p>
        <ul className="space-y-2">
          <ChecklistItem
            done={temAvaliacao}
            label="1. Avaliação clínica aplicada"
            action={
              !temAvaliacao && onNavigateTab ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => onNavigateTab("avaliacoes")}
                >
                  Ir para Avaliações
                </Button>
              ) : undefined
            }
          />
          <ChecklistItem
            done={temFrequencia}
            label="2. Frequência de atendimento definida"
            action={
              !temFrequencia ? (
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link to="/app/pacientes/$pacienteId" params={{ pacienteId }}>
                    Abrir cadastro
                  </Link>
                </Button>
              ) : undefined
            }
          />
          <ChecklistItem done={temObjetivos} label="3. Objetivos por sessão cadastrados" />
          <ChecklistItem done={temPdf} label="4. PDF de periodização anexado" />
        </ul>
      </div>

      {semConsultaExperimental && (
        <Alert>
          <AlertTitle>Primeira Consulta Experimental pendente</AlertTitle>
          <AlertDescription>
            Recomendamos registrar a Primeira Consulta Experimental no cadastro do paciente antes de
            montar a periodização. Você ainda pode cadastrar o plano normalmente.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Periodização em PDF</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Importe o plano de periodização do paciente. Um arquivo por paciente — ao importar
            novamente, o anterior é substituído.
          </p>
        </div>
        {periodizacaoPdfUrl ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Documento importado</span>
            <Button variant="ghost" size="sm" asChild>
              <a href={periodizacaoPdfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" /> Abrir PDF
              </a>
            </Button>
            {!readOnly && canRemovePdf && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => removePdfMutation.mutate()}
                disabled={removePdfMutation.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum PDF importado ainda.</p>
        )}
        {!readOnly && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="periodizacao-pdf-input" className="sr-only">
                Arquivo PDF
              </Label>
              <Input
                id="periodizacao-pdf-input"
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={() => uploadPdfMutation.mutate()}
              disabled={!pdfFile || uploadPdfMutation.isPending}
            >
              <Upload className="mr-1 h-4 w-4" />
              {uploadPdfMutation.isPending ? "Importando…" : "Importar PDF"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Periodização de sessões</h2>
          <p className="text-sm text-muted-foreground">
            Plano clínico ordenado por número de sessão — mesma fonte usada no prontuário.
          </p>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar sessão
          </Button>
        )}
      </div>

      {itens.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão no plano"
          description="Cadastre objetivos, fisio responsável e atividades previstas para acompanhar a evolução do tratamento."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Nº</TableHead>
                <TableHead>Fisio</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Atividades</TableHead>
                <TableHead>Status</TableHead>
                {!readOnly && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.numeroSessao}</TableCell>
                  <TableCell className="max-w-[140px] truncate">
                    {item.fisioterapeutaNome ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{item.objetivo ?? "—"}</TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {item.atividadesPrevistas ?? "—"}
                  </TableCell>
                  <TableCell>{STATUS_LABEL[item.status]}</TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => abrirEditar(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar sessão do plano" : "Nova sessão no plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nº da sessão</Label>
              <Input
                type="number"
                min={1}
                value={numero}
                onChange={(e) => setNumero(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Fisioterapeuta</Label>
              <Select
                value={fisioId || "__none__"}
                onValueChange={(v) => setFisioId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {fisios
                    .filter((f) => f.ativo)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
            </div>
            <div>
              <Label>Atividades previstas</Label>
              <Textarea
                rows={3}
                value={atividades}
                onChange={(e) => setAtividades(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PeriodizacaoStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as PeriodizacaoStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
