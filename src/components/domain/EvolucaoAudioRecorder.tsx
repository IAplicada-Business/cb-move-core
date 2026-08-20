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

const MAX_RECORDING_MS = 5 * 60 * 1000;

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function getSpeechRecognitionClass(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** iOS (incl. Chrome) não expõe SpeechRecognition de forma confiável — gravamos áudio e transcrevemos no backend. */
function preferMediaRecorder(): boolean {
  if (isMobileDevice()) return true;
  if (typeof MediaRecorder === "undefined") return false;
  return !getSpeechRecognitionClass();
}

function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case "network":
      return "Serviço de voz indisponível. Verifique a conexão ou use a transcrição manual.";
    case "not-allowed":
    case "service-not-allowed":
      return "Permissão de microfone negada. Libere o microfone nas configurações do navegador.";
    case "audio-capture":
      return "Microfone não encontrado ou em uso por outro app.";
    case "aborted":
      return "";
    default:
      return `Erro no reconhecimento de voz (${code}). Tente novamente ou digite manualmente.`;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Falha ao ler áudio gravado"));
    reader.readAsDataURL(blob);
  });
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function EvolucaoAudioRecorder({
  pacienteId,
  onResult,
  buttonLabel = "Gravar evolução",
  primaryButtonClassName,
}: Props) {
  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [manualText, setManualText] = React.useState("");
  const [showManual, setShowManual] = React.useState(false);
  const [micHint, setMicHint] = React.useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);

  const modeRef = React.useRef<"speech" | "media">("media");
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef = React.useRef("");
  const shouldSendRef = React.useRef(false);
  const networkRetriesRef = React.useRef(0);
  const retryingRef = React.useRef(false);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const mimeTypeRef = React.useRef("audio/webm");
  const timerRef = React.useRef<number | null>(null);
  const startedAtRef = React.useRef(0);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    stopTimer();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_RECORDING_MS) {
        toast.info("Tempo máximo de gravação atingido (5 min). Processando…");
        void stopRecording();
      }
    }, 500);
  }

  function cleanupMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
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
        { timeoutMs: 45_000 },
      );
      handleTranscricaoResult(result);
    } catch (err) {
      toast.warning(
        "Não foi possível estruturar com IA agora (" +
          (err instanceof Error ? err.message : "erro desconhecido") +
          "). Preencha S/O/P manualmente.",
      );
      onResult(fallbackResult(transcricao_raw));
    } finally {
      setProcessing(false);
    }
  }

  async function sendAudio(blob: Blob, mimeType: string) {
    if (blob.size < 800) {
      toast.warning("Gravação muito curta ou vazia. Tente falar mais perto do microfone.");
      return;
    }

    setProcessing(true);
    try {
      const audio_base64 = await blobToBase64(blob);
      const result = await invokeEdgeFunction<TranscricaoResult>(
        "transcribe-audio",
        { audio_base64, mime_type: mimeType, paciente_id: pacienteId },
        { timeoutMs: 120_000 },
      );
      handleTranscricaoResult(result);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao transcrever áudio. Tente novamente ou digite manualmente.",
      );
      setShowManual(true);
    } finally {
      setProcessing(false);
    }
  }

  function handleTranscricaoResult(result: TranscricaoResult) {
    if (result.aviso) {
      toast.info(result.aviso);
    } else if (!result.subjetivo && !result.objetivo && !result.plano) {
      toast.info("Transcrição concluída. Revise os campos S/O/P antes de salvar.");
    } else {
      toast.success("Evolução estruturada pela IA");
    }
    onResult(result);
  }

  function finishSpeechRecording() {
    const text = finalTextRef.current.trim();
    if (!text) {
      toast.warning("Nenhum áudio detectado na gravação.");
      return;
    }
    void sendText(text);
  }

  async function startMediaRecording() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicHint("Seu navegador não suporta gravação de áudio.");
      setShowManual(true);
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setMicHint("Gravação de áudio não disponível neste navegador.");
      setShowManual(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      mediaStreamRef.current = stream;
      mimeTypeRef.current = getSupportedAudioMimeType();
      audioChunksRef.current = [];

      const rec = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stopTimer();
        setRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        cleanupMediaStream();
        if (shouldSendRef.current) {
          shouldSendRef.current = false;
          void sendAudio(blob, mimeTypeRef.current);
        }
      };
      rec.onerror = () => {
        stopTimer();
        setRecording(false);
        cleanupMediaStream();
        toast.error("Erro durante a gravação. Tente novamente.");
      };

      mediaRecorderRef.current = rec;
      rec.start(250);
      modeRef.current = "media";
      shouldSendRef.current = false;
      setMicHint(null);
      setRecording(true);
      startTimer();
    } catch {
      setMicHint("Permita o microfone no navegador para gravar por voz.");
      setShowManual(true);
    }
  }

  function startSpeechRecognition() {
    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) {
      void startMediaRecording();
      return;
    }

    const rec = new SpeechRecognitionClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "pt-BR";

    rec.onresult = (e) => {
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          final += result[0].transcript + " ";
        }
      }
      finalTextRef.current = final.trim();
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
        }
      }

      recognitionRef.current = null;
      setRecording(false);
      stopTimer();
      shouldSendRef.current = false;

      const msg = speechErrorMessage(e.error);
      if (msg) {
        toast.error(msg);
        void startMediaRecording();
      }
    };

    rec.onend = () => {
      if (retryingRef.current) return;
      stopTimer();
      setRecording(false);
      recognitionRef.current = null;
      if (!shouldSendRef.current) return;
      shouldSendRef.current = false;
      finishSpeechRecording();
    };

    recognitionRef.current = rec;
    modeRef.current = "speech";
    finalTextRef.current = "";
    networkRetriesRef.current = 0;
    shouldSendRef.current = false;
    rec.start();
    setRecording(true);
    startTimer();
  }

  async function startRecording() {
    shouldSendRef.current = false;
    setMicHint(null);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicHint("Permita o microfone no navegador para gravar por voz.");
      setShowManual(true);
      return;
    }

    if (preferMediaRecorder()) {
      void startMediaRecording();
    } else {
      startSpeechRecognition();
    }
  }

  function stopRecording() {
    shouldSendRef.current = true;
    if (modeRef.current === "media") {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      } else {
        shouldSendRef.current = false;
        setRecording(false);
        stopTimer();
        cleanupMediaStream();
        toast.warning("Gravação não iniciou corretamente. Tente novamente.");
      }
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      shouldSendRef.current = false;
      setRecording(false);
      stopTimer();
      toast.warning("Gravação não iniciou corretamente. Tente novamente.");
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
            onClick={() => void startRecording()}
            disabled={processing}
            className={cn("w-full gap-2 sm:w-auto", primaryButtonClassName)}
          >
            <span>🎤</span>
            {processing ? "Processando IA…" : buttonLabel}
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void stopRecording()}
            className="gap-2 animate-pulse"
          >
            <span>⏹</span>
            Parar e estruturar
          </Button>
        )}
        {recording && (
          <span className="text-xs font-medium text-red-500">
            ● Gravando {formatElapsed(elapsedMs)}
          </span>
        )}
      </div>

      {recording && (
        <p className="text-xs text-muted-foreground">
          Fale a evolução da sessão. O texto não aparece aqui — ao parar, a IA estrutura S/O/P
          automaticamente.
        </p>
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
