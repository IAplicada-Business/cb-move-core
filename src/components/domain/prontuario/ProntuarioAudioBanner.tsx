import { Mic } from "lucide-react";

import {
  EvolucaoAudioRecorder,
  type TranscricaoResult,
} from "@/components/domain/EvolucaoAudioRecorder";

type Props = {
  pacienteId: string;
  canEdit: boolean;
  onTranscricao: (result: TranscricaoResult) => void;
};

export function ProntuarioAudioBanner({ pacienteId, canEdit, onTranscricao }: Props) {
  if (!canEdit) return null;

  return (
    <div className="rounded-xl border border-cb-cyan-100 bg-cb-cyan-050/60 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cb-cyan-600 text-white">
          <Mic className="h-5 w-5" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-semibold text-foreground">Documentação por áudio</p>
          <p className="text-sm text-muted-foreground">
            Grave a evolução da sessão. A IA estrutura em Subjetivo · Objetivo · Plano e você revisa
            antes de salvar.
          </p>
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[12rem]">
        <EvolucaoAudioRecorder
          pacienteId={pacienteId}
          onResult={onTranscricao}
          buttonLabel="Iniciar gravação"
          primaryButtonClassName="w-full border-cb-cyan-600 bg-cb-cyan-600 text-white shadow-sm hover:bg-cb-cyan-700 hover:text-white sm:w-auto"
        />
      </div>
    </div>
  );
}
