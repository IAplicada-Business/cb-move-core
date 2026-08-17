import type { Dispatch, SetStateAction } from "react";
import { Shield } from "lucide-react";

import { LoadingState } from "@/components/domain/LoadingState";
import { DEFAULT_INITIAL_PASSWORD } from "@/lib/default-password";
import { MENU_GROUPS, flattenMenuItems } from "@/lib/menu-access";
import type { UserRow } from "@/lib/queries/usuarios";
import type { UsuarioCadastroPerfil } from "@/lib/usuario-equipe";

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
import { Switch } from "@/components/ui/switch";

export type CadastroFormState = {
  nome: string;
  email: string;
  perfil: UsuarioCadastroPerfil;
  paciente_id: string;
  registro_profissional: string;
  ativo: boolean;
};

const TITULO_NOVO: Record<UsuarioCadastroPerfil, string> = {
  admin: "Novo administrador",
  cliente: "Novo cliente",
  fisio: "Novo fisioterapeuta",
};

const TITULO_EDITAR: Record<UsuarioCadastroPerfil, string> = {
  admin: "Atualizar administrador",
  cliente: "Atualizar cliente",
  fisio: "Atualizar fisioterapeuta",
};

type PacienteOption = { id: string; nome: string };

type UsuarioCadastroDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: UsuarioCadastroPerfil;
  form: CadastroFormState;
  setForm: Dispatch<SetStateAction<CadastroFormState>>;
  editingExistingUser: boolean;
  users: UserRow[];
  pacienteQuery: string;
  setPacienteQuery: (value: string) => void;
  pacientes: PacienteOption[];
  loadingPacientes?: boolean;
  onSave: () => void;
  pending: boolean;
};

function AcessoTotalPreview() {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <Label className="mb-0 font-medium">Acesso total</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Administradores veem todos os módulos do sistema. Não é necessário configurar permissões
        individuais.
      </p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {MENU_GROUPS.flatMap((g) => flattenMenuItems(g.items)).map((item) => (
          <li key={item.key} className="text-xs text-foreground">
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UsuarioCadastroDialog({
  open,
  onOpenChange,
  tipo,
  form,
  setForm,
  editingExistingUser,
  users,
  pacienteQuery,
  setPacienteQuery,
  pacientes,
  loadingPacientes,
  onSave,
  pending,
}: UsuarioCadastroDialogProps) {
  const isEdit = !!users.find((u) => u.email?.toLowerCase() === form.email.trim().toLowerCase());
  const title = isEdit ? TITULO_EDITAR[tipo] : TITULO_NOVO[tipo];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
              disabled={editingExistingUser}
              readOnly={editingExistingUser}
            />
            {editingExistingUser ? (
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado após o cadastro.
              </p>
            ) : null}
          </div>

          {tipo === "admin" && <AcessoTotalPreview />}

          {tipo === "fisio" && (
            <>
              <div className="space-y-1.5">
                <Label>CREFITO</Label>
                <Input
                  value={form.registro_profissional}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, registro_profissional: e.target.value }))
                  }
                  placeholder="CREFITO-3/XXXXX-F"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(ativo) => setForm((f) => ({ ...f, ativo }))}
                  id="fisio-ativo"
                />
                <Label htmlFor="fisio-ativo" className="mb-0">
                  Ativo
                </Label>
              </div>
              <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                Dados clínicos e acesso ao sistema são criados juntos. O profissional aparece na aba{" "}
                <strong>Fisioterapeutas</strong> após salvar. Menu lateral fixo (Meus pacientes,
                Minha agenda, Prontuário).
              </p>
            </>
          )}

          {tipo === "cliente" && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label>Paciente vinculado</Label>
              <Input
                value={pacienteQuery}
                onChange={(e) => setPacienteQuery(e.target.value)}
                placeholder="Buscar paciente…"
              />
              {loadingPacientes ? (
                <LoadingState />
              ) : (
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
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Senha inicial padrão: <strong>{DEFAULT_INITIAL_PASSWORD}</strong>. No primeiro login, a
            pessoa será redirecionada para definir a senha pessoal.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={pending} onClick={onSave}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
