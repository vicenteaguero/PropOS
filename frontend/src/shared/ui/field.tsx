import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: ReactNode;
  /** Helper text under the control, linked to it via aria-describedby. */
  hint?: ReactNode;
  /** Error text. Also flips aria-invalid on the control. */
  error?: ReactNode;
  className?: string;
  labelClassName?: string;
  /** The control. A single element, so its id can be injected. */
  children: ReactNode;
}

/**
 * A labelled form control whose label is actually wired to it.
 *
 * The codebase kept rendering `<Label>Título</Label>` next to an `<Input>` with
 * no `htmlFor`/`id` between them. Visually that looks finished; for anyone on a
 * screen reader the field announces as "edit text, blank", and clicking the
 * label doesn't focus the input for anyone at all. Doing it by hand needs a
 * unique id per field, which is exactly the kind of bookkeeping that gets
 * skipped — so `Field` owns it: `useId()` mints the id, the label claims it,
 * and the child is cloned with it.
 *
 *   <Field label="Título">
 *     <Input value={title} onChange={…} />
 *   </Field>
 *
 * A child that already carries an `id` keeps it, and the label follows.
 */
/**
 * A labelled cluster of controls that are NOT a single form input — chip rows,
 * segmented switches, entity pickers, upload widgets.
 *
 * `<Label htmlFor>` is wrong here: there is no one input to point at, and a
 * label referencing a `<button>` associates with nothing. The correct shape is
 * a named group, so assistive tech announces "Prioridad, group" on entry and
 * the caption is not left floating as decoration.
 */
export function FieldGroup({
  label,
  hint,
  className,
  labelClassName,
  children,
}: Omit<FieldProps, "error">) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={hintId}
      className={cn("space-y-1", className)}
    >
      <span
        id={`${id}-label`}
        className={cn("flex items-center gap-2 text-sm leading-none font-medium", labelClassName)}
      >
        {label}
      </span>
      {children}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Field({ label, hint, error, className, labelClassName, children }: FieldProps) {
  const generatedId = useId();

  const childId =
    isValidElement(children) && typeof (children.props as { id?: unknown }).id === "string"
      ? (children.props as { id: string }).id
      : undefined;
  const id = childId ?? generatedId;

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        ...(error ? { "aria-invalid": true } : null),
      })
    : children;

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
