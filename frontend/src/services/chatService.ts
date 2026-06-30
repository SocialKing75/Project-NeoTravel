export type ChatMessagePayload = {
  message: string;
  conversationId?: string;
  prospectId?: string;
};

export type ChatMessageResponse = {
  reply: string;
  slots: Record<string, unknown> | null;
  missing: string[] | null;
  complete: boolean | null;
};

export async function sendChatMessage(payload: ChatMessagePayload): Promise<ChatMessageResponse> {
  const { message, conversationId, prospectId } = payload;

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      sessionId: conversationId,
      context: prospectId ? { prospectId } : undefined,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Échec de l'envoi du message (statut ${response.status}).`);
  }

  return response.json();
}
