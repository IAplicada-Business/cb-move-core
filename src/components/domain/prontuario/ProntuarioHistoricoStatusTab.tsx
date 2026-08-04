import { FileText } from "lucide-react";

import { EmptyState } from "@/components/domain/EmptyState";
import { Button } from "@/components/ui/button";

type Props = {
  onOpenDocumentos?: () => void;
};

export function ProntuarioHistoricoStatusTab({ onOpenDocumentos }: Props) {
  return (
    <EmptyState
      icon={<FileText className="h-8 w-8" />}
      title="Histórico de documentos assinados"
      description="Em breve você poderá consultar aqui todos os documentos assinados do paciente. Enquanto isso, relatórios mensais podem ser gerados e assinados na aba Documentos."
      action={
        onOpenDocumentos ? (
          <Button variant="outline" onClick={onOpenDocumentos}>
            Ir para Documentos
          </Button>
        ) : undefined
      }
    />
  );
}
