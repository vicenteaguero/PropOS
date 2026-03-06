import { Mic, Square, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMicrophone } from "@shared/hooks/use-microphone";
import { useMediaUpload } from "@shared/hooks/use-media-upload";
import { toast } from "sonner";

interface AudioRecorderProps {
  onSaved?: (url: string) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function AudioRecorder({ onSaved }: AudioRecorderProps) {
  const { isRecording, audioBlob, audioUrl, duration, error, startRecording, stopRecording, clearRecording } = useMicrophone();
  const { upload, uploading } = useMediaUpload();

  async function handleSave() {
    if (!audioBlob) return;
    const url = await upload(audioBlob, "audio");
    if (url) {
      toast.success("Audio guardado");
      onSaved?.(url);
      clearRecording();
    } else {
      toast.error("Error al guardar audio");
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isRecording && (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="size-3 animate-pulse rounded-full bg-destructive" />
          <span className="font-mono text-lg">{formatDuration(duration)}</span>
        </div>
      )}

      {!audioUrl ? (
        <div className="flex justify-center">
          {!isRecording ? (
            <Button variant="outline" className="gap-2" onClick={startRecording}>
              <Mic className="size-4" />
              Grabar Audio
            </Button>
          ) : (
            <Button variant="destructive" className="gap-2" onClick={stopRecording}>
              <Square className="size-4" />
              Detener
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={clearRecording}>
              <RotateCcw className="mr-2 size-4" />
              Reintentar
            </Button>
            <Button onClick={handleSave} disabled={uploading}>
              <Save className="mr-2 size-4" />
              {uploading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
