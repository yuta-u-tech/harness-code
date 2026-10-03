import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { getActiveOrg, resetOrgSource, setOrgSource } from "@/harness/session-export/eligibility"

const env = process.env.HARNESS_ORG_ID

describe("getActiveOrg", () => {
  beforeEach(() => {
    delete process.env.HARNESS_ORG_ID
    resetOrgSource()
  })

  afterEach(() => {
    if (env === undefined) delete process.env.HARNESS_ORG_ID
    else process.env.HARNESS_ORG_ID = env
    resetOrgSource()
  })

  test("returns undefined when no signals are active", async () => {
    setOrgSource(async () => ({ type: "personal" }))
    expect(await getActiveOrg()).toEqual({ type: "personal" })
  })

  test("returns env value when HARNESS_ORG_ID is set", async () => {
    setOrgSource(async () => ({ type: "org", id: "org_auth" }))
    process.env.HARNESS_ORG_ID = "org_envvar"
    expect(await getActiveOrg()).toEqual({ type: "org", id: "org_envvar" })
  })

  test("returns auth-derived org id when env is absent", async () => {
    setOrgSource(async () => ({ type: "org", id: "org_auth" }))
    expect(await getActiveOrg()).toEqual({ type: "org", id: "org_auth" })
  })

  test("returns unknown when org source lookup fails", async () => {
    setOrgSource(async () => {
      throw new Error("auth failed")
    })
    expect(await getActiveOrg()).toEqual({ type: "unknown" })
  })
})
