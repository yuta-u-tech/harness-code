import type { MessageV2 } from "@/session/message-v2"

export namespace HarnessPartLifecycle {
  export const key = "harness.lifecycle"

  export function transient(part: MessageV2.Part) {
    return part.type === "text" && part.metadata?.[key] === "transient"
  }
}
