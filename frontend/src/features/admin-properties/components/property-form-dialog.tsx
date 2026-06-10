import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Property, PropertyInput } from "../api/properties-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property;
  onSubmit: (input: PropertyInput) => Promise<unknown>;
  pending: boolean;
}

export function PropertyFormDialog({ open, onOpenChange, property, onSubmit, pending }: Props) {
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [listingKind, setListingKind] = useState("SALE");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [area, setArea] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(property?.title ?? "");
      setAddress(property?.address ?? "");
      setListingKind(property?.listing_kind ?? "SALE");
      setPrice(
        property?.list_price_cents ? String(Math.round(property.list_price_cents / 100)) : "",
      );
      setBedrooms(property?.bedrooms != null ? String(property.bedrooms) : "");
      setBathrooms(property?.bathrooms != null ? String(property.bathrooms) : "");
      setArea(property?.area_sqm != null ? String(property.area_sqm) : "");
    }
  }, [open, property]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    await onSubmit({
      title: title.trim(),
      address: address.trim() || null,
      listing_kind: listingKind,
      list_price_cents: price ? Math.round(Number(price) * 100) : null,
      bedrooms: bedrooms ? Number(bedrooms) : null,
      bathrooms: bathrooms ? Number(bathrooms) : null,
      area_sqm: area ? Number(area) : null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{property ? "Editar propiedad" : "Nueva propiedad"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="p-title">Título</Label>
            <Input
              id="p-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Depto Las Condes"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="p-address">Dirección</Label>
            <Input id="p-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-kind">Operación</Label>
            <select
              id="p-kind"
              value={listingKind}
              onChange={(e) => setListingKind(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="SALE">Venta</option>
              <option value="RENT">Arriendo</option>
              <option value="LEASE">Leasing</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-price">Precio (CLP)</Label>
            <Input
              id="p-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-bed">Dormitorios</Label>
            <Input
              id="p-bed"
              type="number"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-bath">Baños</Label>
            <Input
              id="p-bath"
              type="number"
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-area">Superficie (m²)</Label>
            <Input
              id="p-area"
              type="number"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {property ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
