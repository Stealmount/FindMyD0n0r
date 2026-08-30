// Zod schema for match responses — Phase 7.1
import { z } from "./index";

// ─── POST /api/matches/respond-public (capability-token donor response) ─────
export const respondPublicSchema = z.object({
  response: z.enum(["approved", "declined"], {
    message: "response must be 'approved' or 'declined'",
  }),
  token: z
    .string({ message: "Missing capability token" })
    .min(10, "Missing capability token"),
});

export type RespondPublicInput = z.infer<typeof respondPublicSchema>;
