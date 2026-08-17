import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronRight,
  LayoutDashboard,
  PieChart,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useMenuAccess, type SidebarGroup as SidebarMenuGroup } from "@/lib/hooks/use-menu-access";
import type { SidebarMenuItem as SidebarMenuItemDef } from "@/lib/hooks/use-menu-access";
import { SidebarThemeFooter } from "@/components/layout/SidebarThemeFooter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const GROUP_ICONS: Record<string, LucideIcon> = {
  op: LayoutDashboard,
  fin: PieChart,
  team: Users,
  cfg: Settings,
};

const ACTIVE_NAV_CLS = cn(
  "data-[active=true]:bg-cb-cyan-050 data-[active=true]:font-semibold data-[active=true]:text-cb-cyan-800",
  "data-[active=true]:relative data-[active=true]:before:absolute data-[active=true]:before:left-0",
  "data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:w-[3px]",
  "data-[active=true]:before:rounded-r-sm data-[active=true]:before:bg-cb-cyan-600",
  "hover:bg-cb-cyan-050/80",
);

const SECTION_TRIGGER_CLS = cn(
  "rounded-lg font-semibold text-cb-ink transition-colors",
  "hover:bg-cb-cyan-050/80 data-[state=open]:bg-cb-cyan-050/60",
  "h-10 group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!p-0",
  "group-data-[collapsible=icon]:justify-center",
);

function isItemActive(pathname: string, to: string) {
  if (to === "/app") return pathname === "/app" || pathname === "/app/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Achata o item e seus submenus, marcando o nível para indentação. */
function flattenNavItems(
  items: SidebarMenuItemDef[],
  depth = 0,
): Array<{ item: SidebarMenuItemDef; depth: number }> {
  return items.flatMap((item) => [
    { item, depth },
    ...flattenNavItems(item.children ?? [], depth + 1),
  ]);
}

function isBranchActive(pathname: string, item: SidebarMenuItemDef): boolean {
  return (
    isItemActive(pathname, item.to) ||
    (item.children ?? []).some((child) => isBranchActive(pathname, child))
  );
}

function isGroupActive(pathname: string, group: SidebarMenuGroup) {
  return group.items.some((it) => isBranchActive(pathname, it));
}

function SidebarNavItem({
  item,
  pathname,
  className,
}: {
  item: SidebarMenuItemDef;
  pathname: string;
  className?: string;
}) {
  const active = isItemActive(pathname, item.to);
  const children = item.children ?? [];
  const childActive = children.some((child) => isBranchActive(pathname, child));
  const [open, setOpen] = useState(active || childActive);
  const Icon = item.icon;

  useEffect(() => {
    if (active || childActive) setOpen(true);
  }, [active, childActive]);

  const link = (
    <SidebarMenuSubButton
      asChild
      isActive={active}
      className={cn("h-9 flex-1 rounded-md", ACTIVE_NAV_CLS, className)}
    >
      <Link to={item.to} preload="intent">
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </Link>
    </SidebarMenuSubButton>
  );

  if (children.length === 0) {
    return <SidebarMenuSubItem>{link}</SidebarMenuSubItem>;
  }

  return (
    <SidebarMenuSubItem>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-0.5">
          {link}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              aria-label={open ? `Recolher ${item.label}` : `Expandir ${item.label}`}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-cb-muted transition-colors hover:bg-cb-cyan-050 hover:text-cb-ink"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-90")}
              />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <SidebarMenuSub className="mx-0 mt-1 border-l border-cb-cyan-100 pl-3">
            <SidebarNavItems items={children} pathname={pathname} className={className} />
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  );
}

function SidebarNavItems({
  items,
  pathname,
  className,
}: {
  items: SidebarMenuItemDef[];
  pathname: string;
  className?: string;
}) {
  return (
    <>
      {items.map((it) => (
        <SidebarNavItem key={it.to} item={it} pathname={pathname} className={className} />
      ))}
    </>
  );
}

function SidebarNavSection({
  group,
  pathname,
  collapsed,
  open,
  onOpenChange,
  groupActive,
}: {
  group: SidebarMenuGroup;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupActive: boolean;
}) {
  const GroupIcon = GROUP_ICONS[group.id] ?? LayoutDashboard;

  if (collapsed) {
    if (group.items.length === 1 && !group.items[0].children?.length) {
      const it = group.items[0];
      const Icon = it.icon;
      const active = isItemActive(pathname, it.to);
      return (
        <SidebarGroup className="p-0 py-0.5">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={it.label}
                  isActive={active}
                  className={cn(SECTION_TRIGGER_CLS, active && "text-cb-cyan-800")}
                >
                  <Link to={it.to} preload="intent">
                    <Icon className="h-4 w-4 shrink-0 text-cb-cyan-700" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      );
    }

    return (
      <SidebarGroup className="p-0 py-0.5">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    isActive={groupActive}
                    className={cn(SECTION_TRIGGER_CLS, groupActive && "text-cb-cyan-800")}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0 text-cb-cyan-700" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-56">
                  <DropdownMenuLabel className="text-xs uppercase tracking-wide text-cb-muted">
                    {group.label}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {flattenNavItems(group.items).map(({ item: it, depth }) => {
                    const active = isItemActive(pathname, it.to);
                    const Icon = it.icon;
                    return (
                      <DropdownMenuItem key={it.to} asChild>
                        <Link
                          to={it.to}
                          preload="intent"
                          style={depth > 0 ? { paddingLeft: `${depth * 1 + 0.5}rem` } : undefined}
                          className={cn(
                            "flex cursor-pointer items-center gap-2",
                            active && "font-semibold text-cb-cyan-800",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {it.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="group/section">
      <SidebarGroup className="p-0 py-0.5">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className={cn(SECTION_TRIGGER_CLS, groupActive && "text-cb-cyan-800")}
                >
                  <GroupIcon className="h-4 w-4 shrink-0 text-cb-cyan-700" />
                  <span className="flex-1 truncate">{group.label}</span>
                  <ChevronRight
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0 text-cb-muted transition-transform duration-200",
                      "group-data-[state=open]/section:rotate-90",
                    )}
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <SidebarMenuSub className="mx-2 border-l border-cb-cyan-100 pl-3">
                  <SidebarNavItems items={group.items} pathname={pathname} />
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { groups, isFisioScoped, fisioScopeLines } = useMenuAccess();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const sidebarCollapsed = sidebarState === "collapsed";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const activeByGroup = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const g of groups) {
      map[g.id] = isGroupActive(pathname, g);
    }
    return map;
  }, [groups, pathname]);

  useEffect(() => {
    if (sidebarCollapsed) return;
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (activeByGroup[g.id]) next[g.id] = true;
      }
      return next;
    });
  }, [activeByGroup, groups, sidebarCollapsed]);

  return (
    <SidebarPrimitive collapsible="icon" className="border-r-0 bg-sidebar">
      <div className="cb-rainbow-strip h-[3px] shrink-0" aria-hidden />

      <SidebarHeader className="h-12 shrink-0 flex-row items-center gap-0 px-3 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <div className="flex h-full w-full items-center gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <button
            type="button"
            onClick={() => sidebarCollapsed && toggleSidebar()}
            className={cn(
              "cb-pin-halo grid h-8 w-8 shrink-0 place-items-center rounded-full p-[2px]",
              sidebarCollapsed && "cursor-pointer transition-opacity hover:opacity-90",
            )}
            aria-label={sidebarCollapsed ? "Expandir menu" : undefined}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-cb-cyan-600">
              <span className="text-base font-bold leading-none">∞</span>
            </div>
          </button>
          <div className="min-w-0 flex-1 leading-none group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-extrabold tracking-wide text-cb-ink">CB MOVE</div>
            <div className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-cb-muted">
              Neuroscience
            </div>
          </div>
          <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0.5 px-2 py-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1.5">
        {groups.map((g) => (
          <SidebarNavSection
            key={g.id}
            group={g}
            pathname={pathname}
            collapsed={sidebarCollapsed}
            open={openGroups[g.id] ?? activeByGroup[g.id]}
            onOpenChange={(next) => setOpenGroups((prev) => ({ ...prev, [g.id]: next }))}
            groupActive={activeByGroup[g.id]}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-0 p-0 group-data-[collapsible=icon]:py-0">
        <SidebarThemeFooter compact={sidebarCollapsed} />

        {isFisioScoped && fisioScopeLines.length > 0 && (
          <div className="px-3 py-3 group-data-[collapsible=icon]:hidden">
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
      <SidebarRail />
    </SidebarPrimitive>
  );
}
