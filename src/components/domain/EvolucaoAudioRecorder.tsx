import * as React from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
};

export function EvolucaoAudioRecorder({ pacienteId, onResult }: Props) {
  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await sendAudio();
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Microfone não disponível");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
    setProcessing(true);
  }

  async function sendAudio() {
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "evolucao.webm");
      formData.append("paciente_id", pacienteId);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        }
      );

      if (!res.ok) throw new Error(await res.text());
      const result: TranscricaoResult = await res.json();

      if (result.transcricao_raw?.includes("[placeholder")) {
        toast.info("Integração OpenAI não configurada. Configure OPENAI_API_KEY nos Supabase Secrets.");
      } else {
        toast.success("Transcrição concluída pela IA");
      }
      onResult(result);
    } catch (err) {
      toast.error("Erro na transcrição: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setProcessing(false);
    }
  }

  return (
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
          {processing ? "Processando..." : "Gravar evolução"}
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
          Parar gravação
        </Button>
      )}
      {recording && (
        <span className="text-xs text-muted-foreground">Gravando...</span>
      )}
    </div>
  );
}
