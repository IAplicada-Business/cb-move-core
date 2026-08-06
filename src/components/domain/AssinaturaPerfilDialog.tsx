import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import {
  fetchProfileAssinaturaPath,
  getProfileAssinaturaSignedUrl,
  uploadProfileAssinatura,
} from "@/lib/queries/prontuario";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssinaturaPerfilDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const { data: storagePath } = useQuery({
    queryKey: ["profile-assinatura", userId],
    queryFn: () => fetchProfileAssinaturaPath(userId),
    enabled: open && !!userId,
  });

  React.useEffect(() => {
    if (!open) {
      setPreviewFile(null);
      setPreviewUrl(null);
      return;
    }
    if (previewFile) {
      const url = URL.createObjectURL(previewFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (!storagePath) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    void getProfileAssinaturaSignedUrl(storagePath).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [open, previewFile, storagePath]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !previewFile) throw new Error("Selecione uma imagem.");
      return uploadProfileAssinatura(userId, previewFile);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-assinatura", userId] });
      toast.success("Assinatura salva");
      setPreviewFile(null);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-cb-cyan-600" />
            Minha assinatura
          </DialogTitle>
          <DialogDescription>
            Cadastre uma vez sua rubrica (PNG transparente recomendado). Será usada ao assinar
            evoluções diárias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview da assinatura"
                className="mx-auto max-h-24 object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma assinatura cadastrada</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assinatura-file">Imagem</Label>
            <Input
              id="assinatura-file"
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!previewFile || saveMutation.isPending}
          >
            {saveMutation.isPending
              ? "Salvando…"
              : storagePath
                ? "Substituir"
                : "Salvar assinatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
