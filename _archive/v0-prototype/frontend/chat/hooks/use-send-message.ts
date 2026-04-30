import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendMessage } from "@features/chat/services/chat-api";
import { useAuth } from "@shared/hooks/use-auth";

interface SendMessageParams {
  conversationId: string;
  content: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ conversationId, content }: SendMessageParams) => {
      if (!user) throw new Error("No autenticado");
      return sendMessage(conversationId, content, user.id, user.tenantId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", variables.conversationId],
      });
    },
  });
}
