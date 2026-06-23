import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, MoreHorizontal, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import type { AppRole } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · CB MOVE" }] }),
  component: UsuariosPage,
});

// ─── types ──────────────────────────────────────────────────────────────────

type ProfileRow = {
  id: string;
  nome: string | null;
  email: string | null;
  created_at: string;
};

type UserWithRole = ProfileRow & { role: AppRole | null };

// ─── helpers ────────────────────────────────────────────────────────────────

const ROLE_MAP: Record<AppRole, { label: string; cls: string }> = {
  admin:    { label: "Admin",    cls: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100" },
  gestao:   { label: "Gestão",   cls: "bg-[#F5F3FF] text-cb-purple border-[#DDD6FE]" },
  recepcao: { label: "Recepção", cls: "bg-[#FFF7ED] text-cb-orange border-[#FED7AA]" },
  fisio:    { label: "Fisio",    cls: "bg-[#F7FEE7] text-cb-lime border-[#BEF264]" },
  paciente: { label: "Paciente", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

function RoleBadge({ role }: { role: AppRole | null }) {
  if (!role) return <span className="text-xs text-muted-foreground">—</span>;
  const cfg = ROLE_MAP[role];
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

const ROLE_LABELS: AppRole[] = ["admin", "gestao", "recepcao", "fisio"];

// ─── data ────────────────────────────────────────────────────────────────────

async function fetchUsers(): Promise<UserWithRole[]> {
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
    supabase.from("profiles").select("id, nome, email, created_at").order("nome"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  if (pErr) throw pErr;
  if (rErr) throw rErr;

  const roleMap = new Map<string, AppRole>();
  for (const r of roles ?? []) {
    roleMap.set(r.user_id, r.role as AppRole);
  }

  return (profiles ?? []).map((p) => ({
    ...p,
    role: roleMap.get(p.id) ?? null,
  }));
}

async function updateUserRole(userId: string, role: AppRole) {
  // upsert: delete existing then insert new
  const db = supabase as any;
  await db.from("user_roles").delete().eq("user_id", userId);
  const { error } = await db.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

// ─── page ────────────────────────────────────────────────────────────────────

function UsuariosPage() {
  const { roles } = useAuth();
  const qc = useQueryClient();

  const [changeRoleUser, setChangeRoleUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("fisio");

  const isAdmin = roles.includes("admin");

  const { data: users = [], isLoading } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: fetchUsers,
    enabled: isAdmin,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      updateUserRole(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      toast.success("Role atualizado");
      setChangeRoleUser(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground">Usuários do sistema</h1>
        </header>
        <EmptyState
          icon={<Lock className="h-8 w-8" />}
          title="Acesso restrito"
          description="Esta seção é visível apenas para administradores."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Usuários do sistema</h1>
        <p className="text-xs text-muted-foreground max-w-sm">
          Novos usuários são criados pelo administrador via convite — não há signup público.
        </p>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Nenhum usuário"
          description="Nenhum perfil encontrado no sistema."
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                  <TableCell><RoleBadge role={u.role} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setChangeRoleUser(u);
                            setSelectedRole(u.role ?? "fisio");
                          }}
                        >
                          Alterar role
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Alterar role modal */}
      <Dialog open={!!changeRoleUser} onOpenChange={(o) => { if (!o) setChangeRoleUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar role — {changeRoleUser?.nome ?? changeRoleUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nova role</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_LABELS.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_MAP[r].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleUser(null)}>Cancelar</Button>
            <Button
              disabled={roleMutation.isPending}
              onClick={() => {
                if (changeRoleUser) {
                  roleMutation.mutate({ userId: changeRoleUser.id, role: selectedRole });
                }
              }}
            >
              {roleMutation.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
