import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  CampoDiasSemana,
  CampoFrequenciaAtendimento,
} from "@/components/domain/AtendimentoCadastroFields";
import {
  PacienteConsultaExperimentalSection,
  consultaDraftFromPaciente,
  emptyConsultaExperimentalDraft,
  hasConsultaExperimentalDraft,
  type ConsultaExperimentalDraft,
} from "@/components/domain/PacienteConsultaExperimentalSection";
import {
  buildPacientePayload,
  emptyPacienteFormValues,
  pacienteCadastroSchema,
  pacienteToFormValues,
  type PacienteCadastroFormValues,
} from "@/components/domain/paciente-cadastro-form";
import { queryKeys } from "@/lib/queries";
import {
  createPaciente,
  updateConsultaExperimental,
  updatePaciente,
  type Paciente,
} from "@/lib/queries/pacientes";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paciente?: Paciente | null;
  onSuccess?: (pacienteId: string) => void;
};

async function fetchConvenios() {
  const { data, error } = await supabase
    .from("convenios")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

export function PacienteCadastroDialog({ open, onOpenChange, paciente, onSuccess }: Props) {
  const qc = useQueryClient();
  const isEditing = !!paciente;
  const [localPaciente, setLocalPaciente] = useState<Paciente | null>(null);
  const [consultaDraft, setConsultaDraft] = useState<ConsultaExperimentalDraft>(
    emptyConsultaExperimentalDraft,
  );

  const form = useForm<PacienteCadastroFormValues>({
    resolver: zodResolver(pacienteCadastroSchema) as Resolver<PacienteCadastroFormValues>,
    defaultValues: emptyPacienteFormValues(),
  });

  const tipoWatch = form.watch("tipo");
  const regimeWatch = form.watch("regimeCobranca");

  const { data: convenios = [] } = useQuery({
    queryKey: ["convenios", "ativos"],
    queryFn: fetchConvenios,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setLocalPaciente(paciente ?? null);
    if (paciente) {
      form.reset(pacienteToFormValues(paciente));
      setConsultaDraft(consultaDraftFromPaciente(paciente));
    } else {
      form.reset(emptyPacienteFormValues());
      setConsultaDraft(emptyConsultaExperimentalDraft());
    }
  }, [open, paciente, form]);

  const mutation = useMutation({
    mutationFn: async (vals: PacienteCadastroFormValues) => {
      const payload = buildPacientePayload(vals);
      if (paciente) {
        await updatePaciente(paciente.id, payload);
        await updateConsultaExperimental(paciente.id, {
          consultaExperimentalEm: consultaDraft.data || null,
          consultaExperimentalFisioId: consultaDraft.fisioId || null,
          consultaExperimentalObservacoes: consultaDraft.observacoes.trim() || null,
        });
        return paciente.id;
      }
      const created = await createPaciente(payload as Parameters<typeof createPaciente>[0]);
      if (hasConsultaExperimentalDraft(consultaDraft)) {
        await updateConsultaExperimental(created.id, {
          consultaExperimentalEm: consultaDraft.data || null,
          consultaExperimentalFisioId: consultaDraft.fisioId || null,
          consultaExperimentalObservacoes: consultaDraft.observacoes.trim() || null,
        });
      }
      return created.id;
    },
    onSuccess: (pacienteId) => {
      qc.invalidateQueries({ queryKey: queryKeys.pacientes.all });
      qc.invalidateQueries({ queryKey: ["financeiro", "extrato"] });
      if (pacienteId) {
        qc.invalidateQueries({ queryKey: queryKeys.prontuario.evolucoes(pacienteId) });
      }
      toast.success(isEditing ? "Paciente atualizado" : "Paciente criado");
      onSuccess?.(pacienteId);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar paciente" : "Novo paciente"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="000.000.000-00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="(51) 99999-0000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="particular">Particular</SelectItem>
                        <SelectItem value="convenio">Convênio</SelectItem>
                        <SelectItem value="judicial">Judicial</SelectItem>
                        <SelectItem value="puc">PUC</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="regimeCobranca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mensalista">Mensalista</SelectItem>
                        <SelectItem value="por_sessao">Por sessão</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {regimeWatch === "mensalista" ? (
              <FormField
                control={form.control}
                name="valorMensal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor mensal (R$)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="1028,00"
                        inputMode="decimal"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="valorSessao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor por sessão (R$)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="150,00"
                        inputMode="decimal"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="modeloRelatorio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo de relatório</FormLabel>
                  <Select value={field.value ?? "convencional"} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="convencional">Convencional</SelectItem>
                      <SelectItem value="unimed">Unimed</SelectItem>
                      <SelectItem value="sharepoint">SharePoint (judicial)</SelectItem>
                      <SelectItem value="puc">PUC</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {tipoWatch === "convenio" && (
              <FormField
                control={form.control}
                name="convenioId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Convênio</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {convenios.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(tipoWatch === "judicial" || tipoWatch === "puc") && (
              <FormField
                control={form.control}
                name="numeroProcesso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do processo</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {tipoWatch === "particular" && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Endereço — obrigatório para emissão automática da NF (tomador particular)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Logradouro</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Rua Exemplo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="numeroEndereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="123" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="complemento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Apto 101" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bairro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="00000-000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="uf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            maxLength={2}
                            placeholder="RS"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="codigoMunicipioIbge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código município IBGE</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="4314902" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Atendimento — usado no extrato financeiro mensal
              </p>
              <FormField
                control={form.control}
                name="frequenciaAtendimento"
                render={({ field }) => <CampoFrequenciaAtendimento field={field} />}
              />
              <FormField
                control={form.control}
                name="diasSemana"
                render={({ field }) => <CampoDiasSemana field={field} />}
              />
            </div>

            <PacienteConsultaExperimentalSection
              embedded
              value={consultaDraft}
              onChange={setConsultaDraft}
              pacienteId={localPaciente?.id}
              onSaved={(patch) => setLocalPaciente((prev) => (prev ? { ...prev, ...patch } : prev))}
            />

            <FormField
              control={form.control}
              name="motivoAcompanhamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo do acompanhamento</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={2}
                      placeholder="Por que este paciente está em tratamento na clínica (diagnóstico, indicação, etc.)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Emissão de NF</p>
              <FormField
                control={form.control}
                name="modoEmissaoNf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modo de emissão</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="automatico_pagamento">
                          Automático após pagamento (Cora/boleto)
                        </SelectItem>
                        <SelectItem value="data_especifica">
                          Data fixa mensal no cadastro
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch("modoEmissaoNf") === "data_especifica" && (
                <FormField
                  control={form.control}
                  name="diaEmissaoNf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia do mês (1–28)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          type="number"
                          min={1}
                          max={28}
                          placeholder="10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Emissão de boleto</p>
              <FormField
                control={form.control}
                name="modoEmissaoBoleto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modo de emissão</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="automatico_pagamento">
                          Manual na tela Cobranças
                        </SelectItem>
                        <SelectItem value="data_especifica">
                          Data fixa mensal no cadastro
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch("modoEmissaoBoleto") === "data_especifica" && (
                <FormField
                  control={form.control}
                  name="diaEmissaoBoleto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia do mês (1–28)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          type="number"
                          min={1}
                          max={28}
                          placeholder="5"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Requer CPF e e-mail no cadastro. Vencimento ≈ dia + 7. Envio automático se
                        n8n estiver configurado.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
