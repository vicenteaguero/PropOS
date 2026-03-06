import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProperty } from "@features/properties/services/properties-api";
import type { Property, PropertyStatus } from "@features/properties/types";

interface UpdateStatusParams {
  id: string;
  status: PropertyStatus;
}

export function useUpdatePropertyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: UpdateStatusParams) => {
      const result = await updateProperty({ id, status });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["properties"] });
      const previous = queryClient.getQueryData<Property[]>(["properties"]);

      queryClient.setQueryData<Property[]>(["properties"], (old) =>
        old?.map((p) => (p.id === id ? { ...p, status } : p)),
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["properties"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}
