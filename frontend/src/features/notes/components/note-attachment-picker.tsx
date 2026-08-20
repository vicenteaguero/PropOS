import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMicrophone } from "@shared/hooks/use-microphone";
import { AudioPlayer } from "@shared/ui";

interface Props {
  value: Blob[];
  onChange: (next: Blob[]) => void;
  disabled?: boolean;
}

const isImage = (b: Blob) => b.type.startsWith("image/");

/**
 * Stages photos and voice memos for a note that does not exist yet.
 *
 * Deliberately holds Blobs rather than uploading on pick: attachments hang off
 * a note id (`media_assets.target_row_id`), so there is nothing to attach to
 * until the note is written. `useCreateNoteWithAttachments` writes the note and
 * then uploads what is staged here.
 */
export function NoteAttachmentPicker({ value, onChange, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const mic = useMicrophone();
  const [previews, setPreviews] = useState<string[]>([]);

  // Object URLs are a manual resource: revoke the previous batch on every
  // change or a long composing session leaks one blob per pick.
  useEffect(() => {
    const urls = value.map((b) => URL.createObjectURL(b));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [value]);

  // A finished recording becomes a staged attachment exactly once.
  const lastBlob = useRef<Blob | null>(null);
  useEffect(() => {
    if (!mic.audioBlob || mic.audioBlob === lastBlob.current) return;
    lastBlob.current = mic.audioBlob;
    onChange([...value, mic.audioBlob]);
  }, [mic.audioBlob, onChange, value]);

  const pick = (files: FileList | null) => {
    if (!files?.length) return;
    onChange([...value, ...Array.from(files)]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAt = (i: number) => onChange(value.filter((_, n) => n !== i));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((blob, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-lg border border-border bg-secondary"
            >
              {isImage(blob) ? (
                <img src={previews[i]} alt="" className="size-16 object-cover" />
              ) : (
                <div className="w-44 px-2 py-1.5">
                  <AudioPlayer src={previews[i] ?? ""} />
                </div>
              )}
              <button
                type="button"
                aria-label="Quitar adjunto"
                onClick={() => removeAt(i)}
                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {mic.error && <p className="text-[12px] text-destructive">{mic.error}</p>}

      <div className="flex gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => pick(e.target.files)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="size-4" />
          Foto
        </Button>
        <Button
          type="button"
          variant={mic.isRecording ? "destructive" : "ghost"}
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={() => (mic.isRecording ? mic.stopRecording() : void mic.startRecording())}
        >
          {mic.isRecording ? (
            <>
              <Square className="size-3.5 fill-current" />
              {mic.duration}s
            </>
          ) : (
            <>
              <Mic className="size-4" />
              Audio
            </>
          )}
        </Button>
        {disabled && <Loader2 className="size-4 animate-spin self-center text-muted-foreground" />}
      </div>
    </div>
  );
}
