import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Effect } from "effect"
import { Agent } from "@/agent/agent"
import { HarnessModeReminders } from "@/harness/session/mode-reminders"
import { Session } from "./session"

export const apply = Effect.fn("SessionReminders.apply")(function* (input: {
  messages: SessionV1.WithParts[]
  agent: Agent.Info
  session: Session.Info
}) {
  return yield* HarnessModeReminders.apply(input)
})

export * as SessionReminders from "./reminders"
