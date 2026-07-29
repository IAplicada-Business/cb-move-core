import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { useMenuAccess } from "@/lib/hooks/use-menu-access";
import { SidebarUserFooter } from "@/components/layout/SidebarUserFooter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const CONFIG_SUBMENU_KEYS = new Set(["cfg.convenios", "cfg.instrumentos", "cfg.templates"]);

const ACTIVE_NAV_CLS = cn(
  "data-[active=true]:bg-cb-cyan-050 data-[active=true]:font-semibold data-[active=true]:text-cb-cyan-800",
  "data-[active=true]:relative data-[active=true]:before:absolute data-[active=true]:before:left-0",
  "data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:w-[3px]",
  "data-[active=true]:before:rounded-r-sm data-[active=true]:before:bg-cb-cyan-600",
  "hover:bg-cb-cyan-050/80",
);

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { groups, isFisioScoped, fisioScopeLines } = useMenuAccess();

  return (
    <SidebarPrimitive collapsible="icon" className="border-r border-sidebar-border">
      <div className="cb-rainbow-strip h-[3px] shrink-0" aria-hidden />

      <SidebarHeader>
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="cb-pin-halo grid h-9 w-9 shrink-0 place-items-center rounded-full p-[2px]">
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-cb-cyan-600">
              <span className="text-lg font-bold leading-none">∞</span>
            </div>
          </div>
          <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-extrabold tracking-wide text-cb-ink">CB MOVE</div>
            <div className="truncate text-[9.5px] font-semibold uppercase tracking-[0.18em] text-cb-muted">
              Neuroscience
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => {
          const topItems = g.items.filter((it) => !CONFIG_SUBMENU_KEYS.has(it.key));
          const subItems = g.items.filter((it) => CONFIG_SUBMENU_KEYS.has(it.key));
          const configSubOpen = subItems.some(
            (it) => pathname === it.to || pathname.startsWith(`${it.to}/`),
          );

          return (
            <SidebarGroup key={g.id}>
              <SidebarGroupLabel className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-cb-muted">
                {g.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {topItems.map((it) => {
                    const active =
                      pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
                    const Icon = it.icon;

                    return (
                      <SidebarMenuItem key={it.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={it.label}
                          className={ACTIVE_NAV_CLS}
                        >
                          <Link to={it.to} preload="intent">
                            <Icon className="h-4 w-4" />
                            <span>{it.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}

                  {subItems.length > 0 && (
                    <Collapsible defaultOpen={configSubOpen} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip="Cadastros" className={ACTIVE_NAV_CLS}>
                            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            <span>Cadastros</span>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {subItems.map((it) => {
                              const active = pathname === it.to || pathname.startsWith(`${it.to}/`);
                              const Icon = it.icon;
                              return (
                                <SidebarMenuSubItem key={it.to}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={active}
                                    className={ACTIVE_NAV_CLS}
                                  >
                                    <Link to={it.to} preload="intent">
                                      <Icon className="h-4 w-4" />
                                      <span>{it.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarUserFooter />

        {isFisioScoped && fisioScopeLines.length > 0 && (
          <div className="border-t border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cb-muted">
              Sua visão inclui
            </p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-cb-muted">
              {fisioScopeLines.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cb-cyan-600"
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SidebarFooter>
    </SidebarPrimitive>
  );
}
