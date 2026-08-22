import { useEffect, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Property, PropertyInput } from "../api/properties-api";
import { Field, FieldGroup, ResponsiveSheet, Segmented, SheetActions } from "@shared/ui";
import { useUfToday } from "@features/uf/hooks/use-uf";
import { cn } from "@/lib/utils";
import { trackAction } from "@core/telemetry/usage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property;
  onSubmit: (input: PropertyInput) => Promise<unknown>;
  pending: boolean;
}

const OPERATIONS = [
  { id: "SALE", label: "Venta" },
  { id: "RENT", label: "Arriendo" },
  { id: "LEASE", label: "Leasing" },
];

const PESOS = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const UF = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

/** Digits only, so the field can be repainted with separators as it is typed. */
const digits = (raw: string) => raw.replace(/\D/g, "").slice(0, 12);

/**
 * A count a broker taps rather than types.
 *
 * `<input type="number">` for "how many bedrooms" opens a full numeric keyboard
 * to enter a single character between 1 and 5, and brings spinner arrows drawn
 * for a mouse. Two buttons are faster, and they cannot produce "3.5 bathrooms"
 * or an empty string that used to reach the API as `NaN`.
 */
function Stepper({
  value,
  onChange,
  max = 20,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number;
}) {
  const step = (delta: number) => {
    const next = (value ?? 0) + delta;
    onChange(next <= 0 ? null : Math.min(max, next));
  };
  const btn =
    "flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground transition active:scale-90 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Restar"
        onClick={() => step(-1)}
        disabled={!value}
        className={btn}
      >
        <Minus className="size-4" strokeWidth={2.2} />
      </button>
      <span
        className={cn(
          "w-8 text-center text-[17px] font-semibold tabular-nums",
          value == null && "text-faint",
        )}
      >
        {value ?? "—"}
      </span>
      <button
        type="button"
        aria-label="Sumar"
        onClick={() => step(1)}
        disabled={value != null && value >= max}
        className={btn}
      >
        <Plus className="size-4" strokeWidth={2.2} />
      </button>
    </div>
  );
}

/**
 * Create and edit a property.
 *
 * The old version was seven `<Label>` + `<Input>` pairs in a two-column grid,
 * four of them `type="number"` — so the price of a Chilean flat was entered as
 * `232300000` with no separators and no way to tell 232 million from 23 million
 * at a glance, and bedroom counts came with spinner arrows. Nothing said which
 * operation the price belonged to, though "precio" means a very different
 * number for a sale and for a monthly rent.
 *
 * Now the operation leads, because it changes the meaning of everything under
 * it; the price is grouped and repainted as it is typed, with its value in UF
 * beneath — the unit Chilean sale prices are actually quoted in; and the three
 * measurements share one row.
 */
export function PropertyFormDialog({ open, onOpenChange, property, onSubmit, pending }: Props) {
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [listingKind, setListingKind] = useState("SALE");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [bathrooms, setBathrooms] = useState<number | null>(null);
  const [area, setArea] = useState("");
  const [touched, setTouched] = useState(false);

  const uf = useUfToday();
  const ufValue = uf.data?.today?.value_clp ?? null;
  const priceNumber = price ? Number(price) : null;
  const titleError = touched && !title.trim() ? "Ponle un nombre para reconocerla." : undefined;

  useEffect(() => {
    if (!open) return;
    setTitle(property?.title ?? "");
    setAddress(property?.address ?? "");
    setListingKind(property?.listing_kind ?? "SALE");
    setPrice(property?.list_price_cents ? String(Math.round(property.list_price_cents / 100)) : "");
    setBedrooms(property?.bedrooms ?? null);
    setBathrooms(property?.bathrooms ?? null);
    setArea(property?.area_sqm != null ? String(property.area_sqm) : "");
    setTouched(false);
  }, [open, property]);

  const submit = async () => {
    setTouched(true);
    if (!title.trim()) {
      // Inline, beside the field, not a toast in the corner: a toast about a
      // field names the problem somewhere the eye is not, and disappears.
      return;
    }
    await onSubmit({
      title: title.trim(),
      address: address.trim() || null,
      listing_kind: listingKind,
      list_price_cents: priceNumber != null ? Math.round(priceNumber * 100) : null,
      bedrooms,
      bathrooms,
      area_sqm: area ? Number(area) : null,
    });
    toast.success(property ? "Propiedad guardada" : "Propiedad creada");
    trackAction(property ? "propiedad_editada" : "propiedad_creada");
    onOpenChange(false);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={property ? "Editar propiedad" : "Nueva propiedad"}
      desktopClassName="max-w-lg rounded-xl"
    >
      <div className="mt-4 space-y-4">
        {/* First, because it changes what every number below it means. */}
        <FieldGroup label="Operación">
          <Segmented
            items={OPERATIONS}
            value={listingKind}
            onChange={setListingKind}
            variant="pill"
            gutter={false}
          />
        </FieldGroup>

        <Field label="Título" error={titleError}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Depto 2D/2B, Las Condes"
          />
        </Field>

        <Field label="Dirección">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Av. Apoquindo 1234, Las Condes"
          />
        </Field>

        <Field
          label={listingKind === "SALE" ? "Precio" : "Arriendo mensual"}
          hint={
            priceNumber != null && ufValue
              ? `≈ ${UF.format(priceNumber / ufValue)} UF`
              : "En pesos. Se muestra el equivalente en UF."
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[15px] text-muted-foreground">
              $
            </span>
            <Input
              // `inputMode`, not `type="number"`: the numeric keypad without the
              // spinner arrows, and — crucially — a text value we can repaint
              // with thousand separators on every keystroke.
              inputMode="numeric"
              value={price ? PESOS.format(Number(price)) : ""}
              onChange={(e) => setPrice(digits(e.target.value))}
              placeholder="0"
              className="pl-7 text-[17px] font-semibold tabular-nums"
            />
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Dormitorios">
            <Stepper value={bedrooms} onChange={setBedrooms} />
          </FieldGroup>
          <FieldGroup label="Baños">
            <Stepper value={bathrooms} onChange={setBathrooms} />
          </FieldGroup>
          <Field label="Superficie">
            <div className="relative">
              <Input
                inputMode="numeric"
                value={area}
                onChange={(e) => setArea(digits(e.target.value))}
                placeholder="0"
                className="pr-9 tabular-nums"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted-foreground">
                m²
              </span>
            </div>
          </Field>
        </div>
      </div>

      <SheetActions>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={pending} className="gap-2">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {property ? "Guardar" : "Crear"}
        </Button>
      </SheetActions>
    </ResponsiveSheet>
  );
}
