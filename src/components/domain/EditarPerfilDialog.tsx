import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { initials, resolveUserAvatarUrl } from "@/lib/format";
import {
  fetchProfileAvatar,
  removeProfileAvatar,
  updateProfileDisplayName,
  uploadProfileAvatar,
} from "@/lib/queries/profile";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditarPerfilDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";
  const fileRef = React.useRef<HTMLInputElement>(null);

  const userName =
    (user?.user_metadata?.nome as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Usuário";

  const [nome, setNome] = React.useState("");
  const [previewFile, setPreviewFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const avatarQuery = useQuery({
    queryKey: ["profile-avatar", userId],
    queryFn: () => fetchProfileAvatar(userId),
    enabled: open && !!userId,
    staleTime: 50 * 60 * 1000,
  });

  const storagePath = avatarQuery.data?.path ?? null;
  const storedAvatarUrl = avatarQuery.data?.url ?? null;

  React.useEffect(() => {
    if (!open) {
      setPreviewFile(null);
      setPreviewUrl(null);
      return;
    }
    setNome(userName === user?.email ? "" : userName);
  }, [open, userName, user?.email]);

  React.useEffect(() => {
    if (!open) return;
    if (previewFile) {
      const url = URL.createObjectURL(previewFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (avatarQuery.isLoading) {
      setPreviewUrl(null);
      return;
    }
    if (storedAvatarUrl) {
      setPreviewUrl(storedAvatarUrl);
      return;
    }
    setPreviewUrl(resolveUserAvatarUrl(user));
  }, [open, previewFile, storedAvatarUrl, avatarQuery.isLoading, user]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Usuário não autenticado.");
      if (!nome.trim()) throw new Error("Informe um nome.");

      if (previewFile) {
        await uploadProfileAvatar(userId, previewFile);
      }
      await updateProfileDisplayName(userId, nome);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-avatar", userId] });
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Perfil atualizado");
      setPreviewFile(null);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Usuário não autenticado.");
      await removeProfileAvatar(userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-avatar", userId] });
      setPreviewFile(null);
      setPreviewUrl(resolveUserAvatarUrl(user));
      toast.success("Foto removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);
  }

  const displayName = nome.trim() || userName;
  const hasUploadedAvatar = Boolean(storagePath || previewFile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <Pencil className="h-4 w-4 text-cb-cyan-600" />
            Editar perfil
          </DialogTitle>
          <DialogDescription>Atualize seu nome de exibição e foto de perfil.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-20 w-20 shadow-sm ring-2 ring-white">
                {previewUrl ? (
                  <AvatarImage src={previewUrl} alt={displayName} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-cb-cyan-600 text-lg font-bold text-white">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center",
                  "rounded-full border-2 border-white bg-cb-cyan-600 text-white shadow-md",
                  "transition-colors hover:bg-cb-cyan-700",
                )}
                aria-label="Alterar foto"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleFileChange}
              />
            </div>
            {hasUploadedAvatar && !previewFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:text-destructive"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate()}
              >
                {removeMutation.isPending ? "Removendo…" : "Remover foto"}
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perfil-nome">Nome de exibição</Label>
            <Input
              id="perfil-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !nome.trim()}
            className="bg-cb-cyan-600 hover:bg-cb-cyan-700"
          >
            {saveMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
