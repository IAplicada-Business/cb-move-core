import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/queries";
import { fetchFisios } from "@/lib/queries/fisioterapeutas";
import { createUser, type UserRow } from "@/lib/queries/usuarios";
import {
  appRoleFromOperational,
  OPERATIONAL_ROLE_DESCRIPTIONS,
  OPERATIONAL_ROLE_LABELS,
  STAFF_OPERATIONAL_ROLES,
  type OperationalRoleUi,
} from "@/lib/user-access";
import { DEFAULT_INITIAL_PASSWORD } from "@/lib/default-password";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type UsuarioFormValues = {
  nome: string;
  email: string;
  operationalRole: OperationalRoleUi;
  paciente_id: string;
  fisioterapeuta_id: string;
};

type UsuarioFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingUser?: UserRow | null;
  prefill?: Partial<UsuarioFormValues>;
  onSuccess?: () => void;
};

const EMPTY_FORM: UsuarioFormValues = {
  nome: "",
  email: "",
  operationalRole: "secretaria",
  paciente_id: "",
  fisioterapeuta_id: "",
};

export function UsuarioFormDialog({
  open,
  onOpenChange,
  existingUser,
  prefill,
  onSuccess,
}: UsuarioFormDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!existingUser?.id;
  const [form, setForm] = useState<UsuarioFormValues>(EMPTY_FORM);
  const [pacienteQuery, setPacienteQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY_FORM,
      ...prefill,
    });
    setPacienteQuery("");
  }, [open, prefill]);

  const { data: fisios = [] } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ativos,
    queryFn: () => fetchFisios({ ativosOnly: true }),
    enabled: open && form.operationalRole === "fisio",
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes", "invite-search", pacienteQuery],
    queryFn: async () => {
      let q = supabase
        .from("pacientes")
        .select("id, nome, email, user_id")
        .is("user_id", null)
        .order("nome")
        .limit(20);
      if (pacienteQuery.trim()) q = q.ilike("nome", `%${pacienteQuery.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && form.operationalRole === "cliente",
  });

  const saveMutation = useMutation({
    mutationFn: async (values: UsuarioFormValues) => {
      const appRole = appRoleFromOperational(values.operationalRole);
      return createUser({
        nome: values.nome.trim(),
        email: values.email.trim(),
        role: appRole,
        paciente_id: values.operationalRole === "cliente" ? values.paciente_id : null,
        fisioterapeuta_id:
          values.operationalRole === "fisio" ? values.fisioterapeuta_id || null : null,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      toast.success(res.message ?? "Usuário salvo");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleOptions: OperationalRoleUi[] = isEdit
    ? ([...STAFF_OPERATIONAL_ROLES, "cliente"] as OperationalRoleUi[])
    : ([...STAFF_OPERATIONAL_ROLES, "cliente"] as OperationalRoleUi[]);

  const canSubmit =
    form.nome.trim() &&
    form.email.trim() &&
    (form.operationalRole !== "cliente" || !!form.paciente_id) &&
    (form.operationalRole !== "fisio" || !!form.fisioterapeuta_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          form.operationalRole === "cliente" ? "max-w-md" : "max-w-lg max-h-[85vh] overflow-y-auto"
        }
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuário" : "Cadastrar usuário"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@exemplo.com"
              disabled={isEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Perfil operacional</Label>
            <Select
              value={form.operationalRole}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  operationalRole: v as OperationalRoleUi,
                  paciente_id: "",
                  fisioterapeuta_id: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {OPERATIONAL_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {OPERATIONAL_ROLE_DESCRIPTIONS[form.operationalRole]}
            </p>
          </div>

          {form.operationalRole === "fisio" && (
            <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
              <Label>Fisioterapeuta vinculado</Label>
              <Select
                value={form.fisioterapeuta_id || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    fisioterapeuta_id: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cadastro de fisio" />
                </SelectTrigger>
                <SelectContent>
                  {fisios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O login passa a ver apenas pacientes vinculados a este fisio (1º agendamento).
              </p>
            </div>
          )}

          {form.operationalRole === "cliente" && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label>Paciente vinculado</Label>
              <Input
                value={pacienteQuery}
                onChange={(e) => setPacienteQuery(e.target.value)}
                placeholder="Buscar paciente…"
              />
              <Select
                value={form.paciente_id}
                onValueChange={(v) => setForm((f) => ({ ...f, paciente_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o paciente" />
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
          )}

          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              Senha inicial: <strong>{DEFAULT_INITIAL_PASSWORD}</strong>. No primeiro login, a
              pessoa define a senha pessoal.
            </p>
          )}
          {isEdit && (
            <p className="text-xs text-muted-foreground">
              Ao salvar, o perfil e vínculos são atualizados. A senha atual do usuário não é
              alterada.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-cb-cyan-600 hover:bg-cb-cyan-700"
            disabled={!canSubmit || saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            {saveMutation.isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
