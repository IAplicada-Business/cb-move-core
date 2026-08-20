import type { Dispatch, SetStateAction } from "react";
import { Shield } from "lucide-react";

import { LoadingState } from "@/components/domain/LoadingState";
import { DEFAULT_INITIAL_PASSWORD } from "@/lib/default-password";
import {
  ALL_MENU_KEYS,
  DEFAULT_MENU_FOR_OPERACIONAL,
  MENU_GROUPS,
  flattenMenuItems,
  type MenuKey,
} from "@/lib/menu-access";
import type { UserRow } from "@/lib/queries/usuarios";
import { USUARIO_CADASTRO_PERFIL_OPTIONS, type UsuarioCadastroPerfil } from "@/lib/usuario-equipe";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  /** Módulos liberados — usado no perfil operacional. */
  menu_permissions: Partial<Record<MenuKey, boolean>>;
};

export function emptyCadastroForm(perfil: UsuarioCadastroPerfil = "fisio"): CadastroFormState {
  return {
    nome: "",
    email: "",
    perfil,
    paciente_id: "",
    registro_profissional: "",
    ativo: true,
    menu_permissions: { ...DEFAULT_MENU_FOR_OPERACIONAL },
  };
}

const TITULO_NOVO: Record<UsuarioCadastroPerfil, string> = {
  admin: "Novo administrador",
  cliente: "Novo cliente",
  fisio: "Novo fisioterapeuta",
  operacional: "Novo usuário da equipe",
};

const TITULO_EDITAR: Record<UsuarioCadastroPerfil, string> = {
  admin: "Atualizar administrador",
  cliente: "Atualizar cliente",
  fisio: "Atualizar fisioterapeuta",
  operacional: "Atualizar usuário da equipe",
};

type PacienteOption = { id: string; nome: string };

type UsuarioCadastroDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CadastroFormState;
  setForm: Dispatch<SetStateAction<CadastroFormState>>;
  editingExistingUser: boolean;
  users: UserRow[];
  pacienteQuery: string;
  setPacienteQuery: (value: string) => void;
  pacientes: PacienteOption[];
  loadingPacientes?: boolean;
  loadingMenus?: boolean;
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

function ModulosAcessoEditor({
  value,
  onChange,
  loading,
}: {
  value: Partial<Record<MenuKey, boolean>>;
  onChange: (next: Partial<Record<MenuKey, boolean>>) => void;
  loading?: boolean;
}) {
  if (loading) return <LoadingState />;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <Label className="mb-0 font-medium">Módulos e telas</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Marque o que esta pessoa pode ver no menu. Gestão de usuários continua só para
          administradores.
        </p>
      </div>
      {MENU_GROUPS.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {flattenMenuItems(group.items).map((item) => {
              if (item.key === "team.usuarios") {
                return (
                  <label
                    key={item.key}
                    className="flex items-start gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground"
                  >
                    <Checkbox checked={false} disabled className="mt-0.5" />
                    <span>
                      {item.label}
                      <span className="mt-0.5 block text-[11px]">Somente administradores</span>
                    </span>
                  </label>
                );
              }
              const checked = value[item.key] ?? DEFAULT_MENU_FOR_OPERACIONAL[item.key] ?? false;
              return (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-2 text-xs"
                >
                  <Checkbox
                    checked={checked}
                    className="mt-0.5"
                    onCheckedChange={(state) => {
                      onChange({ ...value, [item.key]: state === true });
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_MENU_FOR_OPERACIONAL })}
        >
          Restaurar padrão
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const all: Partial<Record<MenuKey, boolean>> = {};
            for (const key of ALL_MENU_KEYS) {
              all[key] = key !== "team.usuarios";
            }
            onChange(all);
          }}
        >
          Liberar quase tudo
        </Button>
      </div>
    </div>
  );
}

export function UsuarioCadastroDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editingExistingUser,
  users,
  pacienteQuery,
  setPacienteQuery,
  pacientes,
  loadingPacientes,
  loadingMenus,
  onSave,
  pending,
}: UsuarioCadastroDialogProps) {
  const perfil = form.perfil;
  const isEdit = !!users.find((u) => u.email?.toLowerCase() === form.email.trim().toLowerCase());
  const title = isEdit ? TITULO_EDITAR[perfil] : TITULO_NOVO[perfil];

  function handlePerfilChange(next: UsuarioCadastroPerfil) {
    if (editingExistingUser) return;
    setForm((current) => ({
      ...emptyCadastroForm(next),
      nome: current.nome,
      email: current.email,
      perfil: next,
    }));
    if (next !== "cliente") setPacienteQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Perfil de acesso</Label>
            {editingExistingUser ? (
              <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">
                {USUARIO_CADASTRO_PERFIL_OPTIONS.find((o) => o.value === perfil)?.label ?? perfil}
              </p>
            ) : (
              <Select
                value={perfil}
                onValueChange={(v) => handlePerfilChange(v as UsuarioCadastroPerfil)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  {USUARIO_CADASTRO_PERFIL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!editingExistingUser && (
              <p className="text-xs text-muted-foreground">
                Escolha o tipo de usuário antes de preencher os demais campos.
              </p>
            )}
          </div>

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

          {perfil === "admin" && <AcessoTotalPreview />}

          {perfil === "operacional" && (
            <ModulosAcessoEditor
              value={form.menu_permissions}
              loading={loadingMenus}
              onChange={(menu_permissions) => setForm((f) => ({ ...f, menu_permissions }))}
            />
          )}

          {perfil === "fisio" && (
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

          {perfil === "cliente" && (
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
          <Button disabled={pending || loadingMenus} onClick={onSave}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
