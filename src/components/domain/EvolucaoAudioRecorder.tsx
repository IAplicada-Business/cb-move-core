import * as React from "react";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  /** Estilo extra do botão principal (ex.: banner cyan no prontuário). */
  primaryButtonClassName?: string;
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
    ? ((
        window as unknown as {
          SpeechRecognition?: SpeechRecognitionCtor;
          webkitSpeechRecognition?: SpeechRecognitionCtor;
        }
      ).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition ??
      null)
    : null;

function speechErrorMessage(code: string): string {
  switch (code) {
    case "network":
      return "Serviço de voz indisponível (conexão). Use Chrome/Edge com internet ou digite a evolução abaixo.";
    case "not-allowed":
    case "service-not-allowed":
      return "Permissão de microfone negada. Libere o microfone no navegador ou digite a evolução abaixo.";
    case "audio-capture":
      return "Microfone não encontrado ou em uso por outro app.";
    case "aborted":
      return "";
    default:
      return `Erro no reconhecimento de voz (${code}). Tente digitar a evolução abaixo.`;
  }
}

export function EvolucaoAudioRecorder({
  pacienteId,
  onResult,
  buttonLabel = "Gravar evolução",
  primaryButtonClassName,
}: Props) {
  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [liveText, setLiveText] = React.useState("");
  const [manualText, setManualText] = React.useState("");
  const [showManual, setShowManual] = React.useState(false);
  const [micHint, setMicHint] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef = React.useRef("");
  const liveTextRef = React.useRef("");
  const shouldSendRef = React.useRef(false);
  const networkRetriesRef = React.useRef(0);
  const retryingRef = React.useRef(false);

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
    networkRetriesRef.current = 0;
    finalTextRef.current = "";
    liveTextRef.current = "";
    setLiveText("");
    setMicHint(null);

    void (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setMicHint("Permita o microfone no navegador para gravar por voz.");
        setShowManual(true);
        return;
      }

      startRecognition();
    })();
  }

  function startRecognition() {
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
      if (e.error === "no-speech" || e.error === "aborted") return;

      if (
        e.error === "network" &&
        networkRetriesRef.current < 2 &&
        recognitionRef.current === rec
      ) {
        networkRetriesRef.current += 1;
        retryingRef.current = true;
        try {
          rec.stop();
          window.setTimeout(() => {
            retryingRef.current = false;
            if (recognitionRef.current === rec) rec.start();
          }, 400);
          return;
        } catch {
          retryingRef.current = false;
          /* segue para mensagem abaixo */
        }
      }

      const msg = speechErrorMessage(e.error);
      if (msg) {
        setMicHint(msg);
        setShowManual(true);
        toast.error(msg);
      }
      setRecording(false);
      shouldSendRef.current = false;
    };

    rec.onend = () => {
      if (retryingRef.current) return;
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
        toast.info(
          "Transcrição salva. Configure ANTHROPIC_API_KEY para estruturação automática S/O/P.",
        );
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
    <div className="flex w-full min-w-[12rem] flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {!recording ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startRecording}
            disabled={processing}
            className={cn("w-full gap-2 sm:w-auto", primaryButtonClassName)}
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
        {recording && <span className="text-xs text-red-500 font-medium">● Gravando...</span>}
      </div>

      {(recording || liveText) && (
        <div className="h-24 overflow-y-auto rounded-md border bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground break-words">
          {liveText || "Ouvindo… fale a evolução da sessão."}
        </div>
      )}

      {micHint && <p className="text-xs text-amber-700 dark:text-amber-400">{micHint}</p>}

      {!recording && (
        <div className="flex w-full flex-col gap-2 sm:items-end">
          {!showManual ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto w-full justify-center px-0 text-xs font-normal text-muted-foreground no-underline hover:text-cb-cyan-800 hover:no-underline sm:w-auto"
              onClick={() => setShowManual(true)}
            >
              Ou digite / cole a transcrição
            </Button>
          ) : (
            <div className="w-full space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm sm:min-w-[280px]">
              <p className="text-xs font-semibold text-foreground">Transcrição manual</p>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                placeholder="Digite ou cole o texto da evolução…"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowManual(false)}
                >
                  Ocultar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={cn(primaryButtonClassName)}
                  disabled={processing || !manualText.trim()}
                  onClick={() => void sendText(manualText.trim())}
                >
                  Estruturar com IA
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
