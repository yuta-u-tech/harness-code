FROM alpine AS base

# Disable the runtime transpiler cache by default inside Docker containers.
# On ephemeral containers, the cache is not useful
ARG BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=${BUN_RUNTIME_TRANSPILER_CACHE_PATH}
RUN apk add libgcc libstdc++ ripgrep

FROM base AS build-amd64
COPY dist/@harness/cli-linux-x64-baseline-musl/bin/harness dist/@harness/cli-linux-x64-baseline-musl/bin/bwrap /usr/local/bin/
COPY dist/@harness/cli-linux-x64-baseline-musl/bin/licenses /usr/local/share/licenses/harness

FROM base AS build-arm64
COPY dist/@harness/cli-linux-arm64-musl/bin/harness dist/@harness/cli-linux-arm64-musl/bin/bwrap /usr/local/bin/
COPY dist/@harness/cli-linux-arm64-musl/bin/licenses /usr/local/share/licenses/harness

ARG TARGETARCH
FROM build-${TARGETARCH}
RUN harness --version
ENTRYPOINT ["harness"]
