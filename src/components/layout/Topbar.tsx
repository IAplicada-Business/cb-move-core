import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Pencil } from "lucide-react";
import { toast } from "sonner";

import { SidebarTrigger } from "@/components/ui/sidebar";
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
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { useMenuAccess } from "@/lib/hooks/use-menu-access";
import { supabase } from "@/integrations/supabase/client";

export function Topbar() {
  const { user, signOut } = useAuth();
  const { primary } = useMenuAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = React.useState(false);
  const [nome, setNome] = React.useState("");
  const [saving, setSaving] = React.useState(false);

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
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <div className="grid h-8 w-8 place-items-center rounded-full bg-cb-cyan-600 text-xs font-bold text-white">
                {initials(userName)}
              </div>
              <div className="hidden min-w-0 text-left leading-tight sm:block">
                <div className="truncate text-sm font-semibold text-foreground">{userName}</div>
                <div className="truncate text-[11px] text-muted-foreground">{userRole}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar nome de exibição
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => signOut().then(() => navigate({ to: "/login" }))}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

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
    </>
  );
}
