import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useTour } from "@shared/hooks/use-tour";
import { useSidebar } from "@/components/ui/sidebar";

export function GuidedTour() {
  const { hasCompletedTour, markCompleted } = useTour();
  const { setOpen } = useSidebar();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasCompletedTour || hasStarted.current) return;
    hasStarted.current = true;

    // Small delay to let the DOM settle
    const timeout = setTimeout(() => {
      // Open sidebar so tour targets are visible
      setOpen(true);

      // Another small delay for sidebar animation
      setTimeout(() => {
        const tour = driver({
          showProgress: true,
          animate: true,
          overlayColor: "rgba(28, 24, 22, 0.85)",
          popoverClass: "propos-tour-popover",
          nextBtnText: "Siguiente",
          prevBtnText: "Anterior",
          doneBtnText: "Listo",
          progressText: "{{current}} de {{total}}",
          steps: [
            {
              element: '[data-slot="sidebar"]',
              popover: {
                title: "Menú de navegación",
                description:
                  "Aquí encontrarás todas las secciones de la aplicación. Puedes expandir o colapsar el menú.",
                side: "right",
                align: "start",
              },
            },
            {
              element: '[data-slot="sidebar-menu"] a[href*="properties"]',
              popover: {
                title: "Propiedades",
                description:
                  "Administra tus propiedades: crea, edita y consulta toda la información de cada una.",
                side: "right",
                align: "center",
              },
            },
            {
              element: '[data-slot="sidebar-menu"] a[href*="contacts"], [data-slot="sidebar-menu"] a[href*="documents"]',
              popover: {
                title: "Secciones adicionales",
                description:
                  "Accede a contactos, documentos y otras herramientas según tu rol en la plataforma.",
                side: "right",
                align: "center",
              },
            },
            {
              element: "header.sticky",
              popover: {
                title: "Barra superior",
                description:
                  "Desde aquí puedes abrir el menú lateral y acceder a tu perfil y opciones de cuenta.",
                side: "bottom",
                align: "center",
              },
            },
            {
              element: "main",
              popover: {
                title: "Área de contenido",
                description:
                  "Aquí se mostrará el contenido de cada sección que selecciones en el menú.",
                side: "top",
                align: "center",
              },
            },
          ],
          onDestroyed: () => {
            markCompleted();
          },
        });

        tour.drive();
      }, 400);
    }, 800);

    return () => clearTimeout(timeout);
  }, [hasCompletedTour, markCompleted, setOpen]);

  return null;
}
