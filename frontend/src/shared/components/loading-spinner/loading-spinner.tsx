interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES["md"];

  return (
    <div className="flex items-center justify-center p-4">
      <div
        className={`${sizeClass} animate-spin rounded-full border-2 border-muted-foreground border-t-primary`}
        role="status"
        aria-label="Cargando"
      >
        <span className="sr-only">Cargando...</span>
      </div>
    </div>
  );
}
