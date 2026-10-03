import { HarnessMarkdown } from "../config/markdown"

export namespace HarnessInstruction {
  export function content(text: string, item: string, options: HarnessMarkdown.Options) {
    return HarnessMarkdown.substitute(text, item, options)
  }

  export async function read(item: string, options: HarnessMarkdown.Options) {
    return content(await HarnessMarkdown.read(item, options), item, options)
  }
}
