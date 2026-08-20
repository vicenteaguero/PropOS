import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  className?: string;
}

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/**
 * Voice-memo player.
 *
 * Replaces `<audio controls>`, whose native chrome is a grey slab that matches
 * nothing around it and renders differently on every platform. A recorded memo
 * only ever needs play/pause, a scrub bar and a duration, so that is all this
 * draws. The element itself stays in the tree (hidden) and remains the source
 * of truth for time and duration.
 */
export function AudioPlayer({ src, className }: AudioPlayerProps) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    // A MediaRecorder blob often reports Infinity until it has been seeked once;
    // durationchange fires again with the real value, so read it there too.
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setTime(0);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
    setTime(el.currentTime);
  };

  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- in-app voice memo, no caption track exists */}
      <audio ref={ref} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar" : "Reproducir"}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-current/15 transition active:scale-90"
      >
        {playing ? (
          <Pause className="size-3.5 fill-current" />
        ) : (
          <Play className="size-3.5 translate-x-px fill-current" />
        )}
      </button>
      <div
        role="presentation"
        onClick={seek}
        className="h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-current/15"
      >
        <div className="h-full rounded-full bg-current/60" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums opacity-60">
        {fmt(duration ? duration - time : 0)}
      </span>
    </div>
  );
}
