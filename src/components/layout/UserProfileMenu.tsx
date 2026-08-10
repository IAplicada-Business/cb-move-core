import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, LogOut, PenLine, Pencil } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AssinaturaPerfilDialog } from "@/components/domain/AssinaturaPerfilDialog";
import { EditarPerfilDialog } from "@/components/domain/EditarPerfilDialog";
import { useAuth } from "@/lib/auth";
import { initials, resolveUserAvatarUrl } from "@/lib/format";
import { useMenuAccess } from "@/lib/hooks/use-menu-access";
import { fetchProfileAvatar } from "@/lib/queries/profile";
import { ROLE_LABELS, can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type UserProfileMenuProps = {
  className?: string;
};

function ProfileActionButton({
  icon,
  label,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60",
        destructive ? "text-destructive hover:bg-destructive/5" : "text-cb-ink",
      )}
    >
      <span className={cn("shrink-0", destructive ? "text-destructive" : "text-cb-muted")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function UserProfileAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeCls =
    size === "lg" ? "h-20 w-20 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-xs";

  return (
    <Avatar
      className={cn(
        "shrink-0 shadow-sm ring-2 ring-white dark:ring-card",
        size === "lg" && "shadow-[0_8px_24px_rgba(63,181,188,0.18)]",
        sizeCls,
        className,
      )}
    >
      {photoUrl ? <AvatarImage src={photoUrl} alt={name} className="object-cover" /> : null}
      <AvatarFallback className="bg-cb-cyan-600 font-bold text-white">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserProfileMenu({ className }: UserProfileMenuProps) {
  const { user, signOut, roles } = useAuth();
  const { primary } = useMenuAccess();
  const navigate = useNavigate();

  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [assinaturaOpen, setAssinaturaOpen] = React.useState(false);

  const userId = user?.id ?? "";
  const podeAssinaturaPerfil = can.editProntuario(roles);

  const userName =
    (user?.user_metadata?.nome as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Usuário";
  const userRole = ROLE_LABELS[primary] ?? "Sem perfil";

  const avatarQuery = useQuery({
    queryKey: ["profile-avatar", userId],
    queryFn: () => fetchProfileAvatar(userId),
    enabled: !!userId,
    staleTime: 50 * 60 * 1000,
  });

  const photoUrl = avatarQuery.isLoading
    ? null
    : (avatarQuery.data?.url ?? resolveUserAvatarUrl(user));

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Menu do usuário"
            className={cn(
              "flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1 pr-2.5",
              "shadow-sm transition-colors hover:bg-muted/50",
              className,
            )}
          >
            <UserProfileAvatar name={userName} photoUrl={photoUrl} size="sm" />
            <span className="hidden max-w-[140px] truncate text-sm font-semibold text-cb-ink md:block">
              {userName}
            </span>
            <ChevronDown className="hidden h-4 w-4 shrink-0 text-cb-muted md:block" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          className="w-72 overflow-hidden rounded-2xl border border-border/70 p-0 shadow-lg"
        >
          <div className="border-b border-border/60 bg-gradient-to-r from-cb-cyan-050/80 to-transparent px-4 py-5 text-center dark:from-cb-cyan-900/70 dark:via-cb-cyan-800/35 dark:to-transparent">
            <div className="flex justify-center">
              <UserProfileAvatar name={userName} photoUrl={photoUrl} size="lg" />
            </div>
            <p className="mt-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-cb-cyan-700 dark:text-cb-cyan-300">
              Meu perfil
            </p>
            <p className="mt-1 truncate text-sm font-bold text-cb-ink">{userName}</p>
            <p className="mt-0.5 truncate text-xs text-cb-muted">{user?.email}</p>
          </div>

          <div className="border-b border-border/50 px-4 py-1">
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-cb-muted">Perfil</span>
              <span className="font-medium text-cb-ink">{userRole}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border/40 py-2.5 text-sm">
              <span className="text-cb-muted">E-mail</span>
              <span className="truncate font-medium text-cb-ink">{user?.email ?? "—"}</span>
            </div>
          </div>

          <div className="space-y-0.5 p-2">
            <ProfileActionButton
              icon={<Pencil className="h-4 w-4" />}
              label="Editar perfil"
              onClick={() => {
                setOpen(false);
                setEditOpen(true);
              }}
            />
            {podeAssinaturaPerfil && (
              <ProfileActionButton
                icon={<PenLine className="h-4 w-4" />}
                label="Minha assinatura"
                onClick={() => {
                  setOpen(false);
                  setAssinaturaOpen(true);
                }}
              />
            )}
            <div className="my-1 h-px bg-border/60" />
            <ProfileActionButton
              icon={<LogOut className="h-4 w-4" />}
              label="Sair"
              destructive
              onClick={() => {
                setOpen(false);
                signOut().then(() => navigate({ to: "/login" }));
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      <EditarPerfilDialog open={editOpen} onOpenChange={setEditOpen} />
      <AssinaturaPerfilDialog open={assinaturaOpen} onOpenChange={setAssinaturaOpen} />
    </>
  );
}
