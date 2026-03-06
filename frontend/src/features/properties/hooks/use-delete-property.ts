import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteProperty } from "@features/properties/services/properties-api";

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProperty(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Propiedad eliminada correctamente");
    },
    onError: () => {
      toast.error("Error al eliminar la propiedad");
    },
  });
}
