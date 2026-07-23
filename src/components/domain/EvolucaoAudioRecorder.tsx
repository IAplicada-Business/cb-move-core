import * as React from "react";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { toast } from "sonner";

export type TranscricaoResult = {
  transcricao_raw: string;
  subjetivo: string;
  objetivo: string;
  plano: string;
  aviso?: string;
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
  const shouldSendRef = React.useRef(false);

  if (!SpeechRecognitionClass) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Gravação de áudio requer Chrome ou Edge.
      </p>
    );
  }

  function finishRecording() {
    const text = (finalTextRef.current || liveTextRef.current).trim();
    if (!text) {
      toast.warning("Nenhum áudio detectado.");
      return;
    }
    void sendText(text);
  }

  function startRecording() {
    shouldSendRef.current = false;
    finalTextRef.current = "";
    liveTextRef.current = "";
    setLiveText("");

    const rec = new SpeechRecognitionClass!();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "pt-BR";

    rec.onresult = (e) => {
      // `e.results` sempre contém o histórico completo da sessão (modo contínuo),
      // não apenas o resultado mais recente — por isso reconstruímos o texto final
      // e interino do zero em cada evento, em vez de acumular sobre o texto
      // anterior (o que duplicava/"deformava" a transcrição a cada nova frase).
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      finalTextRef.current = final.trim();
      const merged = (final + interim).trim();
      liveTextRef.current = merged;
      setLiveText(merged);
    };

    rec.onerror = (e) => {
      if (e.error !== "no-speech") toast.error("Erro no microfone: " + e.error);
    };

    rec.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
      if (!shouldSendRef.current) return;
      shouldSendRef.current = false;
      finishRecording();
    };

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }

  function stopRecording() {
    if (!recognitionRef.current) return;
    shouldSendRef.current = true;
    setRecording(false);
    recognitionRef.current.stop();
  }

  function fallbackResult(transcricao_raw: string): TranscricaoResult {
    return {
      transcricao_raw,
      subjetivo: transcricao_raw,
      objetivo: "",
      plano: "",
    };
  }

  async function sendText(transcricao_raw: string) {
    setProcessing(true);
    try {
      const result = await invokeEdgeFunction<TranscricaoResult>(
        "transcribe-audio",
        { transcricao_raw, paciente_id: pacienteId },
        { timeoutMs: 20_000 },
      );

      if (result.aviso) {
        toast.info(result.aviso);
      } else if (!result.subjetivo && !result.objetivo && !result.plano) {
        toast.info("Transcrição salva. Configure ANTHROPIC_API_KEY para estruturação automática S/O/P.");
      } else {
        toast.success("Evolução estruturada pela IA");
      }
      onResult(result);
    } catch (err) {
      // Qualquer falha ao chamar a IA (rede, timeout, função indisponível) NUNCA
      // deve descartar o que já foi ditado — sempre preserva a transcrição bruta
      // e abre a evolução para revisão manual do S/O/P.
      toast.warning(
        "Não foi possível estruturar com IA agora (" +
          (err instanceof Error ? err.message : "erro desconhecido") +
          "). Transcrição mantida — preencha S/O/P manualmente.",
      );
      onResult(fallbackResult(transcricao_raw));
    } finally {
      setLiveText("");
      liveTextRef.current = "";
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

      {(recording || liveText) && (
        <div className="h-24 overflow-y-auto rounded-md border bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground break-words">
          {liveText || "Ouvindo… fale a evolução da sessão."}
        </div>
      )}
    </div>
  );
}
