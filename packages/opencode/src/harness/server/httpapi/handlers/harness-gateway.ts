import {
  GatewayError,
  fetchCloudSession,
  fetchHarnessImageModels,
  fetchHarnessTranscriptionModels,
  getCloudSessions,
  getOrganizationId,
  getToken,
} from "@harness/harness-gateway"
import {
  HEADER_FEATURE,
  HARNESS_API_BASE,
  clearModesCache,
  fetchBalance,
  fetchHarnessNotifications,
  fetchHarnessPassState,
  fetchOrganizationModes,
  fetchProfile,
} from "@harness/harness-gateway"
import { DIRECT_FIM_ENV, requestMistralFim, resolveFimTarget } from "@harness/harness-gateway/fim"
import { DIRECT_EDIT_ENV, extractFencedBody, resolveEditTarget } from "@harness/harness-gateway/edit"
import { buildMercuryEditPrompt } from "@harness/harness-gateway/edit-prompt"
import { buildHarnessHeaders } from "@harness/harness-gateway"
import { Effect, Schema } from "effect"
import * as Stream from "effect/Stream"
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import * as Log from "@opencode-ai/core/util/log"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Database } from "@opencode-ai/core/database/database"
import { HarnessConfig } from "@/harness/config/config"
import { ClaudeMigration } from "@/harness/config/claude-migration"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { organization as catalogOrganization } from "@/harness/provider/catalog"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Storage } from "@/storage/storage"
import { Instance } from "@/harness/instance"
import { InstanceStore } from "@/project/instance-store"
import { ModelCache } from "@/provider/model-cache"
import { InstanceHttpApi } from "@/server/routes/instance/httpapi/api"
import { AudioTranscriptionsBody, CloudSessionImportError, EditBody, FimBody } from "../groups/harness-gateway"

const FIM_TIMEOUT_MS = 30_000
const log = Log.create({ service: "harness-gateway" })

function jsonError(error: string, status: number) {
  return HttpServerResponse.jsonUnsafe({ error }, { status })
}

function logError(route: string, err: unknown) {
  log.error("unhandled error", { route, err })
}

export const harnessGatewayHandlers = HttpApiBuilder.group(InstanceHttpApi, "gateway", (handlers) =>
  Effect.gen(function* () {
    const auth = yield* Auth.Service
    const config = yield* Config.Service
    const store = yield* InstanceStore.Service
    const cache = yield* ModelCache.Service
    const events = yield* EventV2Bridge.Service
    const database = yield* Database.Service
    const storage = yield* Storage.Service

    const profile = Effect.fn("HarnessGatewayHttpApi.profile")(function* () {
      const info = yield* auth.get("harness").pipe(Effect.mapError(() => new HttpApiError.BadRequest({})))
      if (!info || info.type !== "oauth") return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const currentOrgId = info.accountId ?? null
      const [profile, balance, harnessPass] = yield* Effect.tryPromise({
        try: () =>
          Promise.all([
            fetchProfile(info.access),
            fetchBalance(info.access, currentOrgId ?? undefined, log),
            fetchHarnessPassState(info.access),
          ]),
        catch: () => new HttpApiError.BadRequest({}),
      })
      return { profile, balance, harnessPass, currentOrgId }
    })

    const authStatus = Effect.fn("HarnessGatewayHttpApi.authStatus")(function* () {
      const info = yield* auth.get("harness").pipe(Effect.mapError(() => new HttpApiError.BadRequest({})))
      const cfg = yield* config.get()
      const organizationId = catalogOrganization(cfg.provider?.harness?.options, info)
      const type = getToken(info) && (info?.type === "api" || info?.type === "oauth") ? info.type : undefined
      return {
        authenticated: !!type,
        ...(type ? { type } : {}),
        ...(organizationId == null ? {} : { organizationId }),
      }
    })

    const proxyAuth = Effect.fn("HarnessGatewayHttpApi.proxyAuth")(function* () {
      const info = yield* auth.get("harness").pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      return {
        auth: info,
        token: getToken(info),
        organizationId: getOrganizationId(info),
      }
    })

    const modes = Effect.fn("HarnessGatewayHttpApi.modes")(function* () {
      const info = yield* auth.get("harness").pipe(Effect.catch(() => Effect.succeed(undefined)))
      if (!info || info.type !== "oauth" || !info.access || !info.accountId) return { modes: [] }

      const org = info.accountId
      return yield* Effect.promise(() => fetchOrganizationModes(info.access, org)).pipe(
        Effect.map((modes) => ({ modes })),
        Effect.catch(() => Effect.succeed({ modes: [] })),
      )
    })

    const fim = Effect.fn("HarnessGatewayHttpApi.fim")(function* (ctx: { payload: typeof FimBody.Type }) {
      const target = resolveFimTarget(ctx.payload.provider, ctx.payload.model)
      const info = target.provider === "harness" ? yield* proxyAuth() : undefined
      const token = yield* Effect.gen(function* () {
        if (target.provider === "harness") return info?.token
        const item = yield* auth.get(target.provider).pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
        if (item?.type === "api") return item.key
        return DIRECT_FIM_ENV[target.provider].map((key) => process.env[key]).find(Boolean)
      })

      if (target.provider === "harness" && !info?.auth) return yield* Effect.fail(new HttpApiError.Unauthorized({}))
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const request = yield* HttpServerRequest.HttpServerRequest
      const signal =
        request.source instanceof Request
          ? AbortSignal.any([request.source.signal, AbortSignal.timeout(FIM_TIMEOUT_MS)])
          : AbortSignal.timeout(FIM_TIMEOUT_MS)
      const response = yield* Effect.promise(async () => {
        try {
          const run = async (url: string): Promise<Response> => {
            console.info(`[FIM] request provider=${target.provider} model=${target.model} url=${url}`)
            return fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(target.provider === "harness"
                  ? buildHarnessHeaders(undefined, { harnessOrganizationId: info?.organizationId })
                  : {}),
                ...(target.provider === "harness" ? { [HEADER_FEATURE]: "autocomplete" } : {}),
              },
              signal,
              body: JSON.stringify({
                model: target.model,
                prompt: ctx.payload.prefix,
                suffix: ctx.payload.suffix,
                max_tokens: ctx.payload.maxTokens ?? 256,
                temperature: ctx.payload.temperature ?? 0.2,
                stream: true,
              }),
            })
          }
          if (target.provider === "mistral") return requestMistralFim(run)
          return run(target.url)
        } catch (err) {
          if (err instanceof DOMException && err.name === "TimeoutError")
            return Response.json({ error: "FIM request timed out" }, { status: 504 })
          if (signal.aborted) return Response.json({ error: "FIM request canceled" }, { status: 499 })
          throw err
        }
      })
      if (!response.ok) {
        const text = yield* Effect.promise(() => response.text())
        return HttpServerResponse.jsonUnsafe(
          { error: `FIM request failed: ${response.status} ${text}` },
          { status: response.status },
        )
      }
      if (!response.body) return HttpServerResponse.raw(null, { status: response.status })

      return HttpServerResponse.stream(
        Stream.fromReadableStream({
          evaluate: () => response.body!,
          onError: (err) => err,
        }),
        {
          contentType: "text/event-stream",
          headers: {
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        },
      )
    })

    const edit = Effect.fn("HarnessGatewayHttpApi.edit")(function* (ctx: { payload: typeof EditBody.Type }) {
      const target = resolveEditTarget(ctx.payload.provider, ctx.payload.model)
      if (target.provider === "harness" && !target.url) {
        return yield* Effect.fail(new HttpApiError.BadRequest({}))
      }
      const proxy = target.provider === "harness" ? yield* proxyAuth() : undefined
      const token = yield* Effect.gen(function* () {
        if (target.provider === "harness") return proxy?.token
        const item = yield* auth.get(target.provider).pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
        if (item?.type === "api") return item.key
        return DIRECT_EDIT_ENV[target.provider].map((key) => process.env[key]).find(Boolean)
      })
      if (target.provider === "harness" && !proxy?.auth) return yield* Effect.fail(new HttpApiError.Unauthorized({}))
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const request = yield* HttpServerRequest.HttpServerRequest
      const signal =
        request.source instanceof Request
          ? AbortSignal.any([request.source.signal, AbortSignal.timeout(FIM_TIMEOUT_MS)])
          : AbortSignal.timeout(FIM_TIMEOUT_MS)

      // Assemble the Mercury sentinel prompt from the structured context the
      // client sent — same builder every editor frontend shares.
      const content = buildMercuryEditPrompt({
        currentFilePath: ctx.payload.currentFilePath,
        currentFileContent: ctx.payload.currentFileContent,
        cursorLine: ctx.payload.cursorLine,
        cursorCharacter: ctx.payload.cursorCharacter,
        editableRegionStartLine: ctx.payload.editableRegionStartLine,
        editableRegionEndLine: ctx.payload.editableRegionEndLine,
        recentlyViewedSnippets: [...ctx.payload.recentlyViewedSnippets],
        editDiffHistory: [...ctx.payload.editDiffHistory],
      })

      const response = yield* Effect.promise(async () => {
        try {
          return await fetch(target.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(target.provider === "harness"
                ? buildHarnessHeaders(undefined, { harnessOrganizationId: proxy?.organizationId })
                : {}),
              ...(target.provider === "harness" ? { [HEADER_FEATURE]: "autocomplete" } : {}),
            },
            signal,
            body: JSON.stringify({
              model: target.model,
              max_tokens: ctx.payload.maxTokens ?? 512,
              // Mercury rejects role:"system" on this endpoint — must be a single user message.
              messages: [{ role: "user", content }],
            }),
          })
        } catch (err) {
          if (err instanceof DOMException && err.name === "TimeoutError")
            return Response.json({ error: "Edit request timed out" }, { status: 504 })
          if (signal.aborted) return Response.json({ error: "Edit request canceled" }, { status: 499 })
          throw err
        }
      })

      if (!response.ok) {
        // Pass the upstream status through (mirrors the FIM handler) so the
        // client can distinguish auth/credit/rate-limit/server failures
        // instead of collapsing everything to 400.
        const text = yield* Effect.promise(async () => {
          try {
            return await response.text()
          } catch {
            return "<unreadable>"
          }
        })
        return HttpServerResponse.jsonUnsafe(
          { error: `Edit request failed: ${response.status} ${text}` },
          { status: response.status },
        )
      }

      const json = yield* Effect.promise(
        () =>
          response.json() as Promise<{
            choices?: Array<{ message?: { content?: string } }>
            usage?: { prompt_tokens?: number; completion_tokens?: number }
          }>,
      )
      const raw = json.choices?.[0]?.message?.content ?? ""
      const body = extractFencedBody(raw)
      return {
        content: body,
        usage: json.usage
          ? {
              prompt_tokens: json.usage.prompt_tokens,
              completion_tokens: json.usage.completion_tokens,
            }
          : undefined,
      }
    })

    const audioTranscriptions = Effect.fn("HarnessGatewayHttpApi.audioTranscriptions")(function* (ctx: {
      payload: typeof AudioTranscriptionsBody.Type
    }) {
      const info = yield* proxyAuth()
      if (!info.auth) return yield* Effect.fail(new HttpApiError.Unauthorized({}))
      if (!info.token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const request = yield* HttpServerRequest.HttpServerRequest
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`${HARNESS_API_BASE}/api/gateway/v1/audio/transcriptions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${info.token}`,
              ...buildHarnessHeaders(undefined, { harnessOrganizationId: info.organizationId }),
              [HEADER_FEATURE]: "vscode-extension",
            },
            signal: request.source instanceof Request ? request.source.signal : undefined,
            body: JSON.stringify(ctx.payload),
          }),
        catch: () => new HttpApiError.BadRequest({}),
      })
      const text = yield* Effect.promise(() => response.text())
      return HttpServerResponse.raw(text, {
        status: response.status,
        contentType: response.headers.get("Content-Type") ?? "application/json",
      })
    })

    const notifications = Effect.fn("HarnessGatewayHttpApi.notifications")(function* () {
      // Locally-detected notice about leftover opencode config; appended so it reuses each client's dismissal path.
      const notice = HarnessConfig.opencodeConfigNotification({
        directory: Instance.directory,
        worktree: Instance.worktree,
        scanProject: !Flag.HARNESS_DISABLE_PROJECT_CONFIG,
      })
      const claude = yield* Effect.promise(() => ClaudeMigration.notification())
      const append = <T>(list: T[]) => [...list, ...(notice ? [notice] : []), ...(claude ? [claude] : [])]

      const info = yield* auth.get("harness").pipe(Effect.catch(() => Effect.succeed(undefined)))
      const token = getToken(info)
      if (!token) return append([])

      const cloud = yield* Effect.promise(() =>
        fetchHarnessNotifications({
          harnessToken: token,
          harnessOrganizationId: getOrganizationId(info),
        }),
      )
      return append(cloud)
    })

    const organization = Effect.fn("HarnessGatewayHttpApi.organization")(function* (ctx) {
      const info = yield* auth.get("harness").pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      if (!info || info.type !== "oauth") return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      yield* auth
        .set("harness", {
          type: "oauth",
          refresh: info.refresh,
          access: info.access,
          expires: info.expires,
          ...(ctx.payload.organizationId && { accountId: ctx.payload.organizationId }),
        })
        .pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))

      yield* cache.clear("harness")
      clearModesCache()
      yield* store.disposeAll().pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      return true
    })

    const cloudSessions = Effect.fn("HarnessGatewayHttpApi.cloudSessions")(function* (ctx) {
      const info = yield* auth.get("harness").pipe(Effect.mapError(() => new HttpApiError.BadRequest({})))
      const token = getToken(info)
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const query = {
        ...ctx.query,
        limit: ctx.query.limit === undefined ? undefined : Number(ctx.query.limit),
      }

      return yield* Effect.tryPromise({
        try: () => getCloudSessions(token, query),
        catch: (err) => err,
      }).pipe(
        Effect.match({
          onFailure: (err) => {
            if (err instanceof GatewayError) return jsonError(err.message, err.status)
            logError("cloud-sessions", err)
            return jsonError("Internal error", 500)
          },
          onSuccess: (result) => result,
        }),
      )
    })

    const cloudSession = Effect.fn("HarnessGatewayHttpApi.cloudSession")(function* (ctx) {
      const info = yield* auth.get("harness").pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      const token = getToken(info)
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const result = yield* Effect.tryPromise({
        try: () => fetchCloudSession(token, ctx.params.id),
        catch: (err) => err,
      }).pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError("cloud/session/get", err)
            return undefined
          }),
        ),
      )
      if (!result) return jsonError("Internal error", 500)
      if (!result.ok) return jsonError(result.error, result.status)
      return result.data
    })

    const cloudSessionImport = Effect.fn("HarnessGatewayHttpApi.cloudSessionImport")(function* (ctx) {
      // Load the helper lazily: a static top-level import pulls the HTTP
      // handler graph into the remote-sender module graph and breaks the
      // create_session test's module init. Run the helper's Effect on the
      // request Effect (yield*) so the request-scoped InstanceRef/WorkspaceRef
      // reach the persistence path instead of the AppRuntime default context.
      const { CloudSessionImportInProcess } = yield* Effect.promise(() =>
        import("@/harness/server/import-cloud-session-in-process"),
      )
      const outcome = yield* CloudSessionImportInProcess.importSession(ctx.payload.sessionId).pipe(
        Effect.provideService(Auth.Service, auth),
        Effect.provideService(EventV2Bridge.Service, events),
        Effect.provideService(Database.Service, database),
        Effect.provideService(Storage.Service, storage),
        Effect.match({
          onFailure: (err) => {
            if (err instanceof CloudSessionImportInProcess.Unauthorized) return { tag: "unauthorized" as const }
            if (err instanceof CloudSessionImportInProcess.Upstream) {
              return { tag: "upstream" as const, error: err.error, status: err.status }
            }
            if (err instanceof CloudSessionImportInProcess.BadRequest) return { tag: "badrequest" as const }
            return { tag: "internal" as const }
          },
          onSuccess: (session) => ({ tag: "ok" as const, session }),
        }),
      )
      switch (outcome.tag) {
        case "unauthorized":
          return yield* Effect.fail(new HttpApiError.Unauthorized({}))
        case "upstream":
          return jsonError(outcome.error, outcome.status)
        case "badrequest":
          return yield* Effect.fail(new HttpApiError.BadRequest({}))
        case "internal":
          return yield* Effect.fail(new CloudSessionImportError({ error: "Internal error" }))
        case "ok":
          return outcome.session
      }
    })

    const imageModels = Effect.fn("HarnessGatewayHttpApi.imageModels")(function* () {
      const info = yield* proxyAuth()
      if (!info.auth) return yield* Effect.fail(new HttpApiError.Unauthorized({}))
      if (!info.token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const result = yield* Effect.tryPromise({
        try: () =>
          fetchHarnessImageModels({
            harnessToken: info.token,
            harnessOrganizationId: info.organizationId,
          }),
        catch: () => new HttpApiError.BadRequest({}),
      })

      if (result.error) {
        const err =
          result.error.kind === "unauthorized" ? new HttpApiError.Unauthorized({}) : new HttpApiError.BadRequest({})
        return yield* Effect.fail(err)
      }

      return result.models
    })

    const transcriptionModels = Effect.fn("HarnessGatewayHttpApi.transcriptionModels")(function* () {
      const info = yield* proxyAuth()
      if (!info.auth) return yield* Effect.fail(new HttpApiError.Unauthorized({}))
      if (!info.token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const result = yield* Effect.tryPromise({
        try: () =>
          fetchHarnessTranscriptionModels({
            harnessToken: info.token,
            harnessOrganizationId: info.organizationId,
          }),
        catch: () => new HttpApiError.BadRequest({}),
      })

      if (result.error) {
        const err =
          result.error.kind === "unauthorized" ? new HttpApiError.Unauthorized({}) : new HttpApiError.BadRequest({})
        return yield* Effect.fail(err)
      }

      return result.models
    })

    return handlers
      .handle("profile", profile)
      .handle("authStatus", authStatus)
      .handle("modes", modes)
      .handle("fim", fim)
      .handle("edit", edit)
      .handle("audioTranscriptions", audioTranscriptions)
      .handle("imageModels", imageModels)
      .handle("transcriptionModels", transcriptionModels)
      .handle("notifications", notifications)
      .handle("organization", organization)
      .handle("cloudSessions", cloudSessions)
      .handle("cloudSession", cloudSession)
      .handle("cloudSessionImport", cloudSessionImport)
  }),
)
