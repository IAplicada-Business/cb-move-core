import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, PenLine, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssinaturaPerfilDialog } from "@/components/domain/AssinaturaPerfilDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { useMenuAccess } from "@/lib/hooks/use-menu-access";
import { ROLE_LABELS, can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type SidebarUserFooterProps = {
  className?: string;
  compact?: boolean;
};

export function SidebarUserFooter({ className, compact }: SidebarUserFooterProps) {
  const { user, signOut, roles } = useAuth();
  const { primary } = useMenuAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = React.useState(false);
  const [assinaturaOpen, setAssinaturaOpen] = React.useState(false);
  const [nome, setNome] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const podeAssinaturaPerfil = can.editProntuario(roles);

  const userName =
    (user?.user_metadata?.nome as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Usuário";
  const userRole = ROLE_LABELS[primary] ?? "Sem perfil";

  function openEdit() {
    setNome(userName === user?.email ? "" : userName);
    setEditOpen(true);
  }

  async function saveNome() {
    if (!nome.trim()) {
      toast.error("Informe um nome");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { nome: nome.trim() } });
      if (error) throw error;
      toast.success("Nome atualizado");
      setEditOpen(false);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-cb-cyan-050/80",
              className,
            )}
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cb-cyan-600 text-xs font-bold text-white">
              {initials(userName)}
            </div>
            {!compact && (
              <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                <div className="truncate text-[13px] font-semibold text-cb-ink">{userName}</div>
                <div className="truncate text-[10.5px] uppercase tracking-wide text-cb-muted">
                  {userRole}
                </div>
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar nome de exibição
          </DropdownMenuItem>
          {podeAssinaturaPerfil && (
            <DropdownMenuItem onClick={() => setAssinaturaOpen(true)}>
              <PenLine className="mr-2 h-4 w-4" />
              Minha assinatura
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar nome de exibição</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveNome} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssinaturaPerfilDialog open={assinaturaOpen} onOpenChange={setAssinaturaOpen} />
    </>
  );
}
