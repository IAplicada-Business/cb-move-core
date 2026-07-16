import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_MENU_FOR_MEMBRO,
  MENU_GROUPS,
  resolveMenuAccess,
  type MenuGroupDef,
} from "@/lib/menu-access";
import { normalizeRole, type PrimaryRole } from "@/lib/permissions";
import { fetchMenuPermissions } from "@/lib/queries/usuarios";
import { queryKeys } from "@/lib/queries";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, FileText, Calendar,
  Receipt, FileSpreadsheet, BarChart3, Stethoscope, UserCog, Settings, Building2,
  Wrench, FilePlus2, Plug, HelpCircle,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/app": LayoutDashboard,
  "/app/pacientes": Users,
  "/app/prontuario": FileText,
  "/app/agenda": Calendar,
  "/app/cobrancas": Receipt,
  "/app/notas-fiscais": FileSpreadsheet,
  "/app/relatorios": BarChart3,
  "/app/fisios": Stethoscope,
  "/app/usuarios": UserCog,
  "/app/configuracoes": Settings,
  "/app/configuracoes/convenios": Building2,
  "/app/configuracoes/instrumentos": Wrench,
  "/app/configuracoes/templates": FilePlus2,
  "/app/configuracoes/integracoes": Plug,
  "/app/ajuda": HelpCircle,
};

export type SidebarGroup = MenuGroupDef & {
  items: Array<MenuGroupDef["items"][number] & { icon: LucideIcon }>;
};

export function useMenuAccess() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const primary: PrimaryRole = isAdmin ? "admin" : (normalizeRole(roles[0]) ?? "membro");

  const { data: permissions } = useQuery({
    queryKey: queryKeys.usuarios.menuAccess,
    queryFn: () => fetchMenuPermissions("membro"),
    enabled: !isAdmin && primary === "membro",
    staleTime: 60_000,
  });

  const allowedKeys = useMemo(
    () => resolveMenuAccess(primary, permissions ?? DEFAULT_MENU_FOR_MEMBRO),
    [primary, permissions],
  );

  const groups = useMemo<SidebarGroup[]>(() => {
    return MENU_GROUPS.map((group) => ({
      ...group,
      items: group.items
        .filter((item) => allowedKeys.has(item.key))
        .map((item) => ({
          ...item,
          icon: ICONS[item.to] ?? HelpCircle,
        })),
    })).filter((group) => group.items.length > 0);
  }, [allowedKeys]);

  return { groups, primary, isAdmin };
}
