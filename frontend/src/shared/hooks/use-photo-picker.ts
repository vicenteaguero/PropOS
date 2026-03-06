import { useState, useCallback, useRef } from "react";

interface UsePhotoPickerReturn {
  photo: Blob | null;
  photoUrl: string | null;
  error: string | null;
  pickPhoto: () => void;
  clearPhoto: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function usePhotoPicker(): UsePhotoPickerReturn {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pickPhoto = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);

  const clearPhoto = useCallback(() => {
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }
    setPhoto(null);
    setPhotoUrl(null);
    setError(null);
  }, [photoUrl]);

  return { photo, photoUrl, error, pickPhoto, clearPhoto, inputRef };
}
