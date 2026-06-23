import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown, LayoutDashboard, Users, FileText, Calendar, ClipboardCheck,
  Receipt, FileSpreadsheet, BarChart3, Stethoscope, UserCog, Settings, Building2,
  Wrench, FilePlus2, Plug, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number };
type Group = { id: string; label: string; items: Item[] };

const GROUPS: Group[] = [
  { id: "op", label: "Operação", items: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/pacientes", label: "Pacientes", icon: Users },
    { to: "/app/prontuario", label: "Prontuário", icon: FileText },
    { to: "/app/agenda", label: "Agenda", icon: Calendar },
    { to: "/app/frequencia", label: "Frequência", icon: ClipboardCheck },
  ]},
  { id: "fin", label: "Financeiro", items: [
    { to: "/app/cobrancas", label: "Cobranças", icon: Receipt },
    { to: "/app/notas-fiscais", label: "Notas Fiscais", icon: FileSpreadsheet },
    { to: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
  ]},
  { id: "team", label: "Equipe", items: [
    { to: "/app/fisios", label: "Fisioterapeutas", icon: Stethoscope },
    { to: "/app/usuarios", label: "Usuários", icon: UserCog },
  ]},
  { id: "cfg", label: "Configurações", items: [
    { to: "/app/configuracoes", label: "Geral", icon: Settings },
    { to: "/app/configuracoes/convenios", label: "Convênios", icon: Building2 },
    { to: "/app/configuracoes/instrumentos", label: "Instrumentos", icon: Wrench },
    { to: "/app/configuracoes/templates", label: "Templates", icon: FilePlus2 },
    { to: "/app/configuracoes/integracoes", label: "Integrações", icon: Plug },
  ]},
];

export function Sidebar() {
  const { user, roles, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mode, setMode] = React.useState<"admin" | "paciente">("admin");
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    op: true, fin: true, team: true, cfg: false,
  });

  const userName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Usuário";
  const userRole = roles[0] ? ROLE_LABELS[roles[0]] : "Sem perfil";

  return (
    <aside className="relative flex h-screen w-[268px] shrink-0 flex-col border-r bg-sidebar">
      <div className="cb-rainbow-strip absolute inset-x-0 top-0 h-[3px]" />

      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <div className="cb-pin-halo grid h-11 w-11 place-items-center rounded-full p-[2px]">
          <div className="grid h-full w-full place-items-center rounded-full bg-white text-cb-cyan-600">
            <span className="text-xl font-bold leading-none">∞</span>
          </div>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-extrabold tracking-wide text-cb-cyan-900">CB MOVE</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cb-cyan-700">Neuroscience</div>
        </div>
      </div>

      {/* Toggle */}
      <div className="mx-4 mb-3 grid grid-cols-2 rounded-md border bg-muted p-0.5 text-xs">
        {(["admin", "paciente"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-[5px] py-1 font-medium capitalize transition-colors",
              mode === m ? "bg-card text-cb-cyan-900 shadow-sm" : "text-muted-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {GROUPS.map((g) => (
          <div key={g.id} className="mb-1">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}
              className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent"
            >
              {g.label}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open[g.id] ? "" : "-rotate-90")} />
            </button>
            {open[g.id] && (
              <ul className="mt-0.5 space-y-0.5">
                {g.items.map((it) => {
                  const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
                  const Icon = it.icon;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-cb-cyan-050 font-semibold text-cb-cyan-900"
                            : "text-foreground hover:bg-accent",
                        )}
                      >
                        <Icon className={cn("h-4 w-4", active ? "text-cb-cyan-700" : "text-muted-foreground")} />
                        <span className="flex-1">{it.label}</span>
                        {it.badge ? (
                          <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                            {it.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </nav>

      {/* Footer / user */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-cb-cyan-600 text-xs font-bold text-white">
            {initials(userName)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold text-foreground">{userName}</div>
            <div className="truncate text-[11px] text-muted-foreground">{userRole}</div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            title="Sair"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
