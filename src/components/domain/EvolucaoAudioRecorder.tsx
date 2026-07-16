import * as React from "react";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { toast } from "sonner";

export type TranscricaoResult = {
  transcricao_raw: string;
  subjetivo: string;
  objetivo: string;
  plano: string;
};

type Props = {
  pacienteId: string;
  onResult: (r: TranscricaoResult) => void;
  buttonLabel?: string;
};

// Minimal typing for the Web Speech API (SpeechRecognition isn't in every TS lib).
type SpeechRecognitionResultList = {
  length: number;
  [index: number]: { isFinal: boolean; length: number; [index: number]: { transcript: string } };
};
type SpeechRecognitionEventLike = { results: SpeechRecognitionResultList };
type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

const SpeechRecognitionClass: SpeechRecognitionCtor | null =
  typeof window !== "undefined"
    ? ((window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
       (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition ??
       null)
    : null;

export function EvolucaoAudioRecorder({ pacienteId, onResult, buttonLabel = "Gravar evolução" }: Props) {
  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [liveText, setLiveText] = React.useState("");
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef = React.useRef("");
  const liveTextRef = React.useRef("");

  if (!SpeechRecognitionClass) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Gravação de áudio requer Chrome ou Edge.
      </p>
    );
  }

  function startRecording() {
    finalTextRef.current = "";
    setLiveText("");

    const rec = new SpeechRecognitionClass!();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "pt-BR";

    rec.onresult = (e) => {
      let interim = "";
      let final = finalTextRef.current;
      for (let i = e.results.length - 1; i >= 0; i--) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript + " ";
          finalTextRef.current = final;
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      const merged = (final + interim).trim();
      liveTextRef.current = merged;
      setLiveText(merged);
    };

    rec.onerror = (e) => {
      if (e.error !== "no-speech") toast.error("Erro no microfone: " + e.error);
    };

    rec.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);

    const text = (finalTextRef.current || liveTextRef.current).trim();
    if (!text) {
      toast.warning("Nenhum áudio detectado.");
      return;
    }
    sendText(text);
  }

  function fallbackResult(transcricao_raw: string): TranscricaoResult {
    return { transcricao_raw, subjetivo: "", objetivo: "", plano: "" };
  }

  function isEdgeUnavailable(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /404|not found|failed to send|edge function|non-2xx/i.test(msg);
  }

  async function sendText(transcricao_raw: string) {
    setProcessing(true);
    try {
      const result = await invokeEdgeFunction<TranscricaoResult>("transcribe-audio", {
        transcricao_raw,
        paciente_id: pacienteId,
      });

      if (!result.subjetivo && !result.objetivo && !result.plano) {
        toast.info("Transcrição salva. Configure ANTHROPIC_API_KEY para estruturação automática S/O/P.");
      } else {
        toast.success("Evolução estruturada pela IA");
      }
      onResult(result);
      setLiveText("");
      liveTextRef.current = "";
    } catch (err) {
      if (isEdgeUnavailable(err)) {
        toast.info("Serviço de IA indisponível — transcrição mantida; preencha S/O/P manualmente.");
        onResult(fallbackResult(transcricao_raw));
        setLiveText("");
        liveTextRef.current = "";
        return;
      }
      toast.error("Erro: " + (err instanceof Error ? err.message : "Desconhecido"));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {!recording ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startRecording}
            disabled={processing}
            className="gap-2"
          >
            <span>🎤</span>
            {processing ? "Processando IA..." : buttonLabel}
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={stopRecording}
            className="gap-2 animate-pulse"
          >
            <span>⏹</span>
            Parar e estruturar
          </Button>
        )}
        {recording && (
          <span className="text-xs text-red-500 font-medium">● Gravando...</span>
        )}
      </div>

      {liveText && (
        <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground max-h-24 overflow-y-auto">
          {liveText}
        </div>
      )}
    </div>
  );
}
