import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { toast } from "sonner";

import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import {
  ALL_MENU_KEYS,
  DEFAULT_MENU_FOR_MEMBRO,
  MENU_GROUPS,
  type MenuKey,
} from "@/lib/menu-access";
import { fetchMenuPermissions, saveMenuPermissions } from "@/lib/queries/usuarios";
import {
  MENU_ACCESS_PRESETS,
  mergeMenuPermissions,
  type MenuAccessPresetId,
} from "@/lib/user-access";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type UsuarioAcessosPanelProps = {
  className?: string;
  compact?: boolean;
};

export function UsuarioAcessosPanel({ className, compact }: UsuarioAcessosPanelProps) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<MenuKey, boolean>>(DEFAULT_MENU_FOR_MEMBRO);

  const { data: menuPerms, isLoading } = useQuery({
    queryKey: queryKeys.usuarios.menuPermissions("membro"),
    queryFn: () => fetchMenuPermissions("membro"),
    staleTime: 30_000,
  });

  useEffect(() => {
    setDraft(mergeMenuPermissions(menuPerms, DEFAULT_MENU_FOR_MEMBRO));
  }, [menuPerms]);

  const saveMutation = useMutation({
    mutationFn: (permissions: Partial<Record<MenuKey, boolean>>) =>
      saveMenuPermissions("membro", permissions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.menuPermissions("membro") });
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.menuAccess });
      toast.success("Permissões de menu salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enabledCount = useMemo(() => ALL_MENU_KEYS.filter((k) => draft[k]).length, [draft]);
  const dirty = useMemo(() => {
    const saved = mergeMenuPermissions(menuPerms, DEFAULT_MENU_FOR_MEMBRO);
    return ALL_MENU_KEYS.some((k) => draft[k] !== saved[k]);
  }, [draft, menuPerms]);

  function applyPreset(presetId: MenuAccessPresetId) {
    const preset = MENU_ACCESS_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft(preset.permissions);
  }

  if (isLoading) return <LoadingState />;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-2">
        {MENU_ACCESS_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-auto flex-col items-start gap-0.5 px-3 py-2 text-left"
            onClick={() => applyPreset(preset.id)}
          >
            <span className="text-xs font-semibold text-cb-ink">{preset.label}</span>
            {!compact && (
              <span className="text-[10px] font-normal leading-snug text-cb-muted">
                {preset.description}
              </span>
            )}
          </Button>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cb-muted" />
            <p className="text-sm font-medium text-cb-ink">Itens do menu lateral</p>
          </div>
          <Button
            size="sm"
            className="bg-cb-cyan-600 hover:bg-cb-cyan-700"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(draft)}
          >
            {saveMutation.isPending ? "Salvando…" : "Salvar permissões"}
          </Button>
        </div>
        <p className="text-xs text-cb-muted">
          Vale para secretária, gestão e demais perfis operacionais. Administradores veem tudo;
          fisioterapeutas usam menu clínico fixo (escopo por paciente).
        </p>

        {MENU_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted/30"
                >
                  <Checkbox
                    checked={!!draft[item.key]}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({ ...prev, [item.key]: !!checked }))
                    }
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <p className="border-t pt-3 text-xs text-muted-foreground">
          {enabledCount} de {ALL_MENU_KEYS.length} itens habilitados
          {dirty ? " · alterações não salvas" : ""}
        </p>
      </div>
    </div>
  );
}
