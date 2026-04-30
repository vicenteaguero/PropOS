import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

interface PhotoViewerProps {
  open: boolean;
  onClose: () => void;
  slides: { src: string }[];
  index?: number;
}

export function PhotoViewer({ open, onClose, slides, index = 0 }: PhotoViewerProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      slides={slides}
      index={index}
      styles={{
        container: { backgroundColor: "color-mix(in srgb, var(--overlay) 90%, transparent)" },
      }}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}
