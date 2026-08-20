import { lazy, Suspense } from "react";
import { PageSkeleton, SectionTabs, type SectionTab } from "@shared/ui";

const CalendarPage = lazy(() =>
  import("@features/calendar/pages/calendar-page").then((m) => ({ default: m.CalendarPage })),
);
const TasksPage = lazy(() =>
  import("@features/tasks/pages/tasks-page").then((m) => ({ default: m.TasksPage })),
);
const NotesPage = lazy(() =>
  import("@features/notes/pages/notes-page").then((m) => ({ default: m.NotesPage })),
);

/**
 * Everything with a date or a deadline. Adding a note and adding a task are the
 * same gesture from the user's side, so they no longer live two routes apart.
 */
export function AgendaSectionPage() {
  const tabs: SectionTab[] = [
    { id: "calendario", label: "Calendario", render: () => <CalendarPage /> },
    { id: "tareas", label: "Tareas", render: () => <TasksPage /> },
    { id: "notas", label: "Notas", render: () => <NotesPage /> },
  ];
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SectionTabs tabs={tabs} />
    </Suspense>
  );
}

export default AgendaSectionPage;
