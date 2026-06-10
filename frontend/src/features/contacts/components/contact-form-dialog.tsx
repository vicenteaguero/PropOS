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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABELS,
  type Contact,
  type ContactInput,
  type ContactType,
} from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  onSubmit: (input: ContactInput) => Promise<unknown>;
  pending: boolean;
}

export function ContactFormDialog({ open, onOpenChange, contact, onSubmit, pending }: Props) {
  const [fullName, setFullName] = useState("");
  const [type, setType] = useState<ContactType>("BUYER");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setFullName(contact?.full_name ?? "");
      setType(contact?.type ?? "BUYER");
      setPhone(contact?.phone ?? "");
      setEmail(contact?.email ?? "");
      setRut(contact?.rut ?? "");
      setAddress(contact?.address ?? "");
      setNotes(contact?.notes ?? "");
    }
  }, [open, contact]);

  const submit = async () => {
    if (!fullName.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    await onSubmit({
      full_name: fullName.trim(),
      type,
      phone: phone.trim() || null,
      email: email.trim() || null,
      rut: rut.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-name">Nombre completo</Label>
            <Input
              id="c-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Pérez"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-type">Tipo</Label>
            <select
              id="c-type"
              value={type}
              onChange={(e) => setType(e.target.value as ContactType)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CONTACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONTACT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Teléfono</Label>
            <Input
              id="c-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+569..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">Email</Label>
            <Input
              id="c-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-rut">RUT</Label>
            <Input
              id="c-rut"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="12.345.678-9"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-address">Dirección</Label>
            <Input id="c-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-notes">Notas</Label>
            <Textarea
              id="c-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {contact ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
