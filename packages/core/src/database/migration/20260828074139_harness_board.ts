import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260828074139_harness_board",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`harness_board_message\` (
          \`id\` text PRIMARY KEY,
          \`board_root_session_id\` text NOT NULL,
          \`seq\` integer NOT NULL,
          \`time_created\` integer NOT NULL,
          \`sender_session_id\` text NOT NULL,
          \`recipient\` text NOT NULL,
          \`type\` text NOT NULL,
          \`body\` text NOT NULL,
          \`reply_to\` text,
          \`source_message_id\` text NOT NULL,
          \`source_call_id\` text NOT NULL,
          CONSTRAINT \`fk_harness_board_message_board_root_session_id_harness_board_root_session_id_fk\` FOREIGN KEY (\`board_root_session_id\`) REFERENCES \`harness_board\`(\`root_session_id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`harness_board\` (
          \`root_session_id\` text PRIMARY KEY,
          \`objective\` text NOT NULL,
          \`objective_message_id\` text,
          \`next_seq\` integer DEFAULT 1 NOT NULL,
          \`message_count\` integer DEFAULT 0 NOT NULL,
          \`message_bytes\` integer DEFAULT 0 NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_harness_board_root_session_id_session_id_fk\` FOREIGN KEY (\`root_session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(
        `CREATE UNIQUE INDEX \`harness_board_message_board_seq_idx\` ON \`harness_board_message\` (\`board_root_session_id\`,\`seq\`);`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
