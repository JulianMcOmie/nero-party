/**
 * Thrown by the service layer when a game rule is violated (bad phase,
 * unauthorized actor, invalid input). Socket handlers catch these and
 * convert them into a structured `{ ok: false, error }` ack — they are
 * expected control flow, not crashes.
 */
export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

/** Narrow an unknown caught value to a user-safe error message. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof GameError) return error.message;
  if (error instanceof Error) {
    // Don't leak internal error detail to clients.
    console.error("[nero-party] unexpected error:", error);
    return "Something went wrong. Please try again.";
  }
  return "Unknown error.";
}
