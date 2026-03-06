import { useState, useRef, useCallback } from "react";

interface UseCameraReturn {
  stream: MediaStream | null;
  photo: Blob | null;
  photoUrl: string | null;
  isActive: boolean;
  error: string | null;
  startCamera: (facingMode?: "user" | "environment") => Promise<void>;
  stopCamera: () => void;
  takePhoto: () => void;
  clearPhoto: () => void;
}

export function useCamera(): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = useCallback(async (facingMode: "user" | "environment" = "environment") => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
      });
      setStream(mediaStream);
      setIsActive(true);

      // Allow external code to bind video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo acceder a la cámara";
      setError(message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setIsActive(false);
  }, [stream]);

  const takePhoto = useCallback(() => {
    if (!stream) return;

    const video = document.querySelector("[data-camera-viewfinder]") as HTMLVideoElement | null;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setPhoto(blob);
        setPhotoUrl(URL.createObjectURL(blob));
      }
    }, "image/jpeg", 0.85);
  }, [stream]);

  const clearPhoto = useCallback(() => {
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }
    setPhoto(null);
    setPhotoUrl(null);
  }, [photoUrl]);

  return { stream, photo, photoUrl, isActive, error, startCamera, stopCamera, takePhoto, clearPhoto };
}
