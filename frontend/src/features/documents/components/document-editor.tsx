import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Camera, FilePlus2, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Document, Page } from "react-pdf";
import {
  buildReorderedPdf,
  loadPdf,
  pageCount,
  type ReorderInstruction,
} from "../services/pdf-engine";
import { imagesToPdf } from "../services/pdf-from-images";
import { compressBlob } from "../services/image-compression";
import { CameraCaptureDocument } from "./camera-capture-document";

interface SourceDoc {
  id: string;
  bytes: Uint8Array;
  pages: number;
  blobUrl: string;
}

interface PageRef {
  id: string;
  sourceDocIndex: number;
  pageIndex: number;
}

interface Props {
  initialBytes: Uint8Array;
  onCancel: () => void;
  onSave: (bytes: Uint8Array, notes: string | undefined) => Promise<void>;
}

export function DocumentEditor({ initialBytes, onCancel, onSave }: Props) {
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");

  // Ref siempre apunta a sources actual → cleanup correcto on unmount.
  const sourcesRef = useRef<SourceDoc[]>([]);
  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pageCt = await pageCount(initialBytes);
      const blob = new Blob([initialBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      const id = crypto.randomUUID();
      setSources([{ id, bytes: initialBytes, pages: pageCt, blobUrl: url }]);
      setPages(
        Array.from({ length: pageCt }).map((_, i) => ({
          id: `${id}:${i}`,
          sourceDocIndex: 0,
          pageIndex: i,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [initialBytes]);

  // Cleanup blob URLs on unmount usando ref para capturar estado actual.
  useEffect(() => {
    return () => {
      sourcesRef.current.forEach((s) => URL.revokeObjectURL(s.blobUrl));
    };
  }, []);

  const addPdf = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await loadPdf(bytes);
    const count = pdf.getPageCount();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const id = crypto.randomUUID();
    // Updater funcional + acceso a length actual evita race en addPdf concurrente.
    setSources((prev) => {
      const idx = prev.length;
      const newSource: SourceDoc = { id, bytes, pages: count, blobUrl: url };
      const newPageRefs = Array.from({ length: count }).map((_, i) => ({
        id: `${id}:${i}`,
        sourceDocIndex: idx,
        pageIndex: i,
      }));
      // Schedule pages update con queueMicrotask para garantizar consistency
      queueMicrotask(() => setPages((p) => [...p, ...newPageRefs]));
      return [...prev, newSource];
    });
  };

  const addImage = async (file: File) => {
    const compressed = await compressBlob(file, file.name);
    const pdfBytes = await imagesToPdf([compressed]);
    const fakeFile = new File([pdfBytes], `${file.name}.pdf`, { type: "application/pdf" });
    await addPdf(fakeFile);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPages((items) => {
      const oldIndex = items.findIndex((p) => p.id === active.id);
      const newIndex = items.findIndex((p) => p.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const removePage = (id: string) =>
    setPages((prev) => prev.filter((p) => p.id !== id));

  const save = async () => {
    if (pages.length === 0) {
      toast.error("Necesitas al menos una página");
      return;
    }
    setBusy(true);
    try {
      const sourceDocs = await Promise.all(sources.map((s) => loadPdf(s.bytes)));
      const instructions: ReorderInstruction[] = pages.map((p) => ({
        sourceDocIndex: p.sourceDocIndex,
        pageIndex: p.pageIndex,
      }));
      const out = await buildReorderedPdf(sourceDocs, instructions);
      await onSave(out, notes || undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-100px)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
        <Button size="sm" variant="secondary" asChild>
          <label className="cursor-pointer">
            <FilePlus2 className="size-4" /> Agregar PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addPdf(f);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <label className="cursor-pointer">
            <FilePlus2 className="size-4" /> Agregar imagen
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addImage(f);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setCameraOpen(true)}>
          <Camera className="size-4" /> Cámara
        </Button>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas para esta versión (opcional)"
          className="ml-auto w-64 rounded-md border border-border bg-background px-2 py-1 text-xs"
        />
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="size-4" /> Cancelar
        </Button>
        <Button size="sm" onClick={save} disabled={busy}>
          <Save className="size-4" /> Guardar versión
        </Button>
      </div>

      {/* Un Document por SOURCE (no por página) — agrupa thumbnails para evitar OOM. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="overflow-auto rounded-md border border-border bg-card p-3">
            {sources.map((src, srcIdx) => {
              const srcPages = pages.filter((p) => p.sourceDocIndex === srcIdx);
              if (srcPages.length === 0) return null;
              return (
                <Document
                  key={src.id}
                  file={src.blobUrl}
                  loading={null}
                >
                  <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {srcPages.map((page) => (
                      <SortablePage
                        key={page.id}
                        id={page.id}
                        onRemove={() => removePage(page.id)}
                      >
                        <Page
                          pageNumber={page.pageIndex + 1}
                          width={120}
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                        />
                      </SortablePage>
                    ))}
                  </div>
                </Document>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <CameraCaptureDocument
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onPdfReady={(bytes) => {
          const file = new File([bytes], `camera-${Date.now()}.pdf`, { type: "application/pdf" });
          addPdf(file);
        }}
      />
    </div>
  );
}

function SortablePage({
  id,
  onRemove,
  children,
}: {
  id: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="group relative rounded-md border border-border bg-background p-2"
      {...attributes}
    >
      {/* Drag handle = wrapper interior; X button queda fuera del listener */}
      <div className="cursor-grab" {...listeners}>
        {children}
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-1 top-1 z-10 rounded-full bg-destructive p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Eliminar página"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}
