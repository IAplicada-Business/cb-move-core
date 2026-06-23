import * as React from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AudioRecorder({ onComplete }: { onComplete?: (blob: Blob) => void }) {
  const [recording, setRecording] = React.useState(false);
  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  async function start() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      onComplete?.(blob);
      stream.getTracks().forEach((t) => t.stop());
    };
    rec.start();
    mediaRef.current = rec;
    setRecording(true);
  }

  function stop() {
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
  }

  return (
    <Button
      type="button"
      variant={recording ? "destructive" : "secondary"}
      onClick={recording ? stop : start}
      className="gap-2"
    >
      {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {recording ? "Parar" : "Gravar áudio"}
    </Button>
  );
}
