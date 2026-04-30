import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteDocumentConfirm({
  open,
  onOpenChange,
  documentName,
  onConfirm,
  loading,
}: Props) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Eliminar documento"
      description={`Se eliminará "${documentName}". El documento se marca como eliminado y se puede recuperar contactando soporte.`}
      confirmLabel="Eliminar"
      variant="destructive"
      onConfirm={onConfirm}
      loading={loading}
    />
  );
}
