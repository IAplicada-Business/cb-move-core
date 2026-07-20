import { useQuery } from "@tanstack/react-query";
import { ExternalLink, QrCode, Receipt } from "lucide-react";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { queryKeys } from "@/lib/queries";
import { fetchCobrancas } from "@/lib/queries/cobrancas";
import { fetchNFs } from "@/lib/queries/notas-fiscais";
import { brl, formatDate } from "@/lib/format";
import { competenciaLabel } from "@/lib/domain/extrato-financeiro";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PacienteFinanceiroTab({ pacienteId }: { pacienteId: string }) {
  const cobrancasQuery = useQuery({
    queryKey: queryKeys.cobrancas.list({ pacienteId }),
    queryFn: () => fetchCobrancas({ pacienteId }),
    enabled: !!pacienteId,
  });

  const nfsQuery = useQuery({
    queryKey: queryKeys.notasFiscais.list({ pacienteId }),
    queryFn: () => fetchNFs({ pacienteId }),
    enabled: !!pacienteId,
  });

  const cobrancas = cobrancasQuery.data ?? [];
  const nfs = nfsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Cobranças e boletos</h2>
        {cobrancasQuery.isLoading ? (
          <LoadingState />
        ) : cobrancas.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title="Sem cobranças"
            description="Este paciente ainda não tem cobranças registradas."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Boleto/Pix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">
                      {c.competenciaMes && c.competenciaAno
                        ? competenciaLabel(c.competenciaMes, c.competenciaAno)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.servico ?? c.descricao ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{brl(c.valor)}</TableCell>
                    <TableCell className="text-sm">{c.vencimento ? formatDate(c.vencimento) : "—"}</TableCell>
                    <TableCell><StatusBadge value={c.status} /></TableCell>
                    <TableCell>
                      {c.boletoUrl ? (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
                          <a href={c.boletoUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3" /> Boleto
                          </a>
                        </Button>
                      ) : c.pixEmv ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <QrCode className="h-3 w-3" /> Pix
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Notas fiscais emitidas</h2>
        {nfsQuery.isLoading ? (
          <LoadingState />
        ) : nfs.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title="Sem notas fiscais"
            description="Nenhuma NF foi emitida para este paciente ainda."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nfs.map((nf) => (
                  <TableRow key={nf.id}>
                    <TableCell className="font-mono text-sm">{nf.numero ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {nf.competenciaMes && nf.competenciaAno
                        ? competenciaLabel(nf.competenciaMes, nf.competenciaAno)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{brl(nf.valor)}</TableCell>
                    <TableCell className="text-sm">{nf.emissao ? formatDate(nf.emissao) : "—"}</TableCell>
                    <TableCell><StatusBadge kind="nf" value={nf.status} /></TableCell>
                    <TableCell>
                      {nf.pdfUrl ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={nf.pdfUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
