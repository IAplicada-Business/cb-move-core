import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { useMenuAccess } from "@/lib/hooks/use-menu-access";

export function Sidebar() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { groups, primary } = useMenuAccess();
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    op: true, fin: true, team: true, cfg: false,
  });

  const userName = (user?.user_metadata?.nome as string | undefined)
    ?? (user?.user_metadata?.full_name as string | undefined)
    ?? user?.email
    ?? "Usuário";
  const userRole = ROLE_LABELS[primary] ?? (roles[0] ? roles[0] : "Sem perfil");

  return (
    <aside className="relative flex h-full min-h-0 w-[268px] shrink-0 flex-col overflow-hidden border-r bg-sidebar">
      <div className="cb-rainbow-strip absolute inset-x-0 top-0 z-10 h-[3px]" />

      <div className="shrink-0 flex items-center gap-3 px-5 pb-4 pt-6">
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

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.map((g) => (
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
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t bg-sidebar p-3">
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
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
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
