/** Per-request budgets. The system prompt states them to the model. */
export const LIMITS = {
  turns: 12,
  toolCalls: 36,
  geocodes: 20,
  research: 3,
  network: 6,
  points: 50,
  changes: 100,
  locations: 500,
  historyMessages: 10,
  messageChars: 6000,
  savedMessages: 40,
  rememberedAttachments: 3,
  bridgeLog: 200,
} as const;
