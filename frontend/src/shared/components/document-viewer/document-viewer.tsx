import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface DocumentViewerProps {
  url: string;
  filename: string;
  type: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function isImage(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(getExtension(filename));
}

function isPdf(filename: string): boolean {
  return getExtension(filename) === "pdf";
}

export function DocumentViewer({ url, filename, type, open, onOpenChange }: DocumentViewerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="truncate pr-8">{filename}</SheetTitle>
          <SheetDescription>{type}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-4 pb-4">
          {isPdf(filename) ? (
            <iframe
              src={url}
              title={filename}
              className="h-full min-h-[70vh] w-full rounded-md border"
            />
          ) : isImage(filename) ? (
            <img
              src={url}
              alt={filename}
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-md border text-sm text-muted-foreground">
              Vista previa no disponible para este tipo de archivo.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
