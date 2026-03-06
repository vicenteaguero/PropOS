import { useState } from "react";
import { CircleHelp, ChevronDown, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTour } from "@shared/hooks/use-tour";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Como agrego una nueva propiedad?",
    answer:
      'Ve a la seccion "Propiedades" en el menu lateral y presiona el boton "Agregar propiedad". Completa el formulario con los datos requeridos.',
  },
  {
    question: "Como cambio mi contrasena?",
    answer:
      'Haz clic en tu avatar en la esquina superior derecha y selecciona "Configuracion". Desde ahi podras actualizar tu contrasena.',
  },
  {
    question: "Que roles existen en la plataforma?",
    answer:
      "PropOS tiene varios roles: Administrador, Agente, Propietario, Comprador y Contenido. Cada rol tiene acceso a diferentes secciones y funcionalidades.",
  },
  {
    question: "Como subo fotos a una propiedad?",
    answer:
      'Entra al detalle de la propiedad y busca la seccion de fotos. Puedes subir imagenes desde tu dispositivo o tomar fotos con la camara.',
  },
  {
    question: "Como contacto al soporte?",
    answer:
      "Si tienes problemas tecnicos o preguntas adicionales, comunicate con el administrador de tu organizacion.",
  },
];

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const { resetTour } = useTour();

  function handleRestartTour() {
    setOpen(false);
    resetTour();
    // Reload to trigger the tour from scratch
    window.location.reload();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Ayuda"
      >
        <CircleHelp className="size-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Centro de ayuda</SheetTitle>
            <SheetDescription>
              Preguntas frecuentes y tutorial de la aplicacion.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 px-4">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="rounded-lg border border-border">
                <button
                  onClick={() =>
                    setExpandedIndex(expandedIndex === i ? null : i)
                  }
                  className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium"
                >
                  {item.question}
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                      expandedIndex === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedIndex === i && (
                  <p className="px-3 pb-3 text-sm text-muted-foreground">
                    {item.answer}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="px-4 pt-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleRestartTour}
            >
              <RotateCcw className="size-4" />
              Repetir tutorial
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
