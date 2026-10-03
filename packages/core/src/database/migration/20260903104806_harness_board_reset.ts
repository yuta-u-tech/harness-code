import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260903104806_harness_board_reset",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`harness_board\` ADD \`cleared_seq\` integer DEFAULT 0 NOT NULL;`)
    })
  },
} satisfies DatabaseMigration.Migration
