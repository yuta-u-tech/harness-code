import { z } from "zod"
import { HARNESS_API_BASE } from "./constants.js"
import { getDefaultHeaders, buildHarnessHeaders } from "../headers.js"

/**
 * Harness notification schema
 */
export const HarnessNotificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  action: z
    .object({
      actionText: z.string(),
      actionURL: z.string(),
    })
    .optional(),
  showIn: z.array(z.string()).optional(),
  suggestModelId: z.string().optional(),
})

export type HarnessNotification = z.infer<typeof HarnessNotificationSchema>

const NotificationsResponseSchema = z.object({
  notifications: z.array(HarnessNotificationSchema),
})

const NOTIFICATIONS_TIMEOUT_MS = 5000

/**
 * Fetch notifications from Harness API
 *
 * @param options - Configuration with token and optional organization ID
 * @returns Array of notifications from the Harness API (clients filter by showIn)
 */
export async function fetchHarnessNotifications(options: {
  harnessToken?: string
  harnessOrganizationId?: string
}): Promise<HarnessNotification[]> {
  const token = options.harnessToken
  if (!token) return []

  const url = `${HARNESS_API_BASE}/api/users/notifications`

  try {
    const response = await fetch(url, {
      headers: {
        ...getDefaultHeaders(),
        ...buildHarnessHeaders(undefined, { harnessOrganizationId: options.harnessOrganizationId }),
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(NOTIFICATIONS_TIMEOUT_MS),
    })

    if (!response.ok) return []

    const json = await response.json()
    const result = NotificationsResponseSchema.safeParse(json)

    if (!result.success) return []

    return result.data.notifications
  } catch {
    return []
  }
}
