/**
 * Telemetry is not collected. This keeps the call sites that report events working,
 * but nothing is stored or sent anywhere.
 */
export namespace Client {
  export function init(_dir = "") {}

  export function setEnabled(_value: boolean) {}

  export function isEnabled(): boolean {
    return false
  }

  export function capture(_event: unknown, _properties?: Record<string, unknown>) {}

  export function alias(_distinctId: string, _aliasId: string) {}

  export async function shutdown(_timeoutMs?: number): Promise<void> {}

  export function flushInBackground(_delayMs = 300): void {}
}
