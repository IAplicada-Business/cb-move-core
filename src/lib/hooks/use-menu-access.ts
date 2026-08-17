import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_MENU_FOR_FISIO,
  DEFAULT_MENU_FOR_MEMBRO,
  FISIO_MENU_GROUP_LABELS,
  FISIO_MENU_LABELS,
  FISIO_MENU_SCOPE_LINES,
  MENU_GROUPS,
  resolveMenuAccess,
  type MenuGroupDef,
  type MenuItemDef,
} from "@/lib/menu-access";
import { isFisioScopedUser, normalizeRole, type PrimaryRole, can } from "@/lib/permissions";
import { fetchMenuPermissions } from "@/lib/queries/usuarios";
import { queryKeys } from "@/lib/queries";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Receipt,
  FileSpreadsheet,
  ClipboardList,
  PieChart,
  Stethoscope,
  UserCog,
  Settings,
  Building2,
  Wrench,
  FilePlus2,
  HelpCircle,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/app": LayoutDashboard,
  "/app/pacientes": Users,
  "/app/prontuario": FileText,
  "/app/agenda": Calendar,
  "/app/cobrancas": Receipt,
  "/app/notas-fiscais": FileSpreadsheet,
  "/app/financeiro": PieChart,
  "/app/relatorios": ClipboardList,
  "/app/fisios": Stethoscope,
  "/app/usuarios": UserCog,
  "/app/configuracoes": Settings,
  "/app/configuracoes/convenios": Building2,
  "/app/configuracoes/instrumentos": Wrench,
  "/app/configuracoes/templates": FilePlus2,
  "/app/ajuda": HelpCircle,
};

export type SidebarMenuItem = Omit<MenuItemDef, "children"> & {
  icon: LucideIcon;
  children?: SidebarMenuItem[];
};

export type SidebarGroup = {
  id: MenuGroupDef["id"];
  label: MenuGroupDef["label"];
  items: SidebarMenuItem[];
};

export function useMenuAccess() {
  const { roles, fisioterapeutaId } = useAuth();
  const isAdmin = roles.includes("admin");
  const isFisioScoped = isFisioScopedUser(roles, fisioterapeutaId);
  const primary: PrimaryRole = isAdmin ? "admin" : (normalizeRole(roles[0]) ?? "membro");
  const menuDefaults = isFisioScoped ? DEFAULT_MENU_FOR_FISIO : DEFAULT_MENU_FOR_MEMBRO;

  const { data: permissions } = useQuery({
    queryKey: queryKeys.usuarios.menuAccess,
    queryFn: () => fetchMenuPermissions("membro"),
    enabled: !isAdmin && primary === "membro" && !isFisioScoped,
    staleTime: 60_000,
  });

  const allowedKeys = useMemo(() => {
    if (isFisioScoped) {
      return resolveMenuAccess(primary, {}, DEFAULT_MENU_FOR_FISIO);
    }
    return resolveMenuAccess(primary, permissions ?? menuDefaults, menuDefaults);
  }, [primary, permissions, menuDefaults, isFisioScoped]);

  const groups = useMemo<SidebarGroup[]>(() => {
    const isVisible = (item: MenuItemDef) =>
      allowedKeys.has(item.key) && (item.key !== "team.usuarios" || can.manageUsers(roles));

    /** Itens sem permissão somem, mas seus submenus permitidos sobem um nível. */
    const buildItems = (items: MenuItemDef[]): SidebarMenuItem[] =>
      items.flatMap((item) => {
        const children = buildItems(item.children ?? []);
        if (!isVisible(item)) return children;
        const { children: _children, ...rest } = item;
        return [
          {
            ...rest,
            label: isFisioScoped ? (FISIO_MENU_LABELS[item.key] ?? item.label) : item.label,
            icon: ICONS[item.to] ?? HelpCircle,
            ...(children.length > 0 ? { children } : {}),
          },
        ];
      });

    return MENU_GROUPS.map((group) => ({
      ...group,
      label: isFisioScoped ? (FISIO_MENU_GROUP_LABELS[group.id] ?? group.label) : group.label,
      items: buildItems(group.items),
    })).filter((group) => group.items.length > 0);
  }, [allowedKeys, isFisioScoped, roles]);

  return {
    groups,
    primary,
    isAdmin,
    isFisioScoped,
    fisioScopeLines: isFisioScoped ? [...FISIO_MENU_SCOPE_LINES] : [],
  };
}
