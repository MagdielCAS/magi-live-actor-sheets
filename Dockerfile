# syntax=docker/dockerfile:1

# Build the new web page. Like the Go stage below, this runs on the machine
# architecture of the runner: the output is plain text files that do not
# depend on an architecture, and npm ci under an emulator is very slow.
#
# BuildKit does not run a stage that no other stage copies from, so this
# stage costs nothing until the COPY at the end of the file names it. See
# the note there.
FROM --platform=$BUILDPLATFORM node:22-alpine AS web

WORKDIR /src/app

# The lock file first, so a change in the source does not make the
# dependency layer invalid.
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY app/ ./
# The example character lives in the old page, and the build reads it from
# there. See app/src/dev/fixture.ts.
COPY web/js/fixture.js /src/web/js/fixture.js

RUN npm run build && npm run check-dist


# Build the relay. The build runs on the machine architecture of the runner
# and cross-compiles for the target, because a Go build does not need an
# emulator. This is much faster than a build under QEMU.
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS build

WORKDIR /src/server

# Copy the module files first, so a change in the source does not make the
# dependency layer invalid.
COPY server/go.mod server/go.sum ./
RUN go mod download

COPY server/ ./

ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/magi-server ./cmd/magi-server


FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -H -u 10001 magi

# The binary looks for the web page in ../web, next to its own directory.
COPY --from=build /out/magi-server /app/bin/magi-server

# The image still ships the old page.
#
# The new page in app/ is a working frame, not yet equal to this one, so it
# must not reach a player until it is. The change is one line, and this is
# it:
#
#     COPY --from=web /src/app/dist/ /app/web/
#
# Until then the "web" stage above is not named by any COPY, so BuildKit
# skips it and the image build costs nothing extra. The CI workflow builds
# and tests app/ on its own, so the stage cannot rot in the meantime.
COPY web/ /app/web/

# The container must listen on every address. The default of the binary is
# 127.0.0.1, which nothing outside the container can reach.
ENV MAGI_BIND=0.0.0.0:30001

# LAN trust is off in a container, and this is important.
#
# A client on a private address connects with no pairing code. Behind a
# reverse proxy such as the one in Coolify, every request arrives from the
# Docker network, and a Docker network uses private addresses. With LAN
# trust on, the server would therefore treat every visitor from the
# internet as a member of your network, and any person could open any
# character sheet.
#
# Turn this on again only if you also set MAGI_TRUSTED_PROXIES to the
# address of your proxy. The server then reads the real client address
# from X-Forwarded-For.
ENV MAGI_TRUST_LAN=false

USER magi
EXPOSE 30001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:30001/healthz || exit 1

ENTRYPOINT ["/app/bin/magi-server"]
