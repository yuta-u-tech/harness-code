import { BackgroundProcess } from "@/harness/background-process"
import { SessionID } from "@/session/schema"
import { Effect } from "effect"

export namespace HarnessTaskBackgroundProcess {
  export function finish(sessionID: SessionID) {
    return Effect.promise(() => BackgroundProcess.stopSession(sessionID)).pipe(Effect.ignore)
  }
}
