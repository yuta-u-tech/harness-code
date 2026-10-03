import { ConfigParse } from "@/config/parse"

export namespace HarnessMcpConfig {
  export function format(file: string, input: string) {
    if (file.endsWith(".jsonc")) return input
    return JSON.stringify(ConfigParse.jsonc(input, file), null, 2)
  }
}
