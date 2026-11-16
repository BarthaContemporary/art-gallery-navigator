# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# @jvb/image-worker — built by infra/compose/docker-compose.yml with
# `build: ../image-worker`, so the build context is this directory only
# (standalone; no workspace files are needed inside the image).
#
# NOTE on tsx: we deliberately keep `tsx` in "dependencies" (not
# devDependencies) and run the TypeScript source directly with `tsx` instead
# of compiling with tsc. That lets this image do a production-only install
# and still have its runtime available — a tsc build stage would add
# complexity for zero benefit in a single small worker.
#
# Dependencies install from this directory's own pnpm-lock.yaml, frozen:
# the image gets exactly the versions CI audited (the `worker-lockfile` job
# in .github/workflows/ci.yml checks the lockfile matches package.json and
# runs `pnpm audit` on it). After changing package.json, regenerate it here
# with `pnpm install --ignore-workspace --lockfile-only` and commit it.
#
# The base image is pinned by digest (node:22-slim as of 16 November 2026),
# like every other image in the compose file (infra/README.md §7). To take
# a newer Node 22 or Debian patches, replace the digest with the one
# `docker buildx imagetools inspect node:22-slim` prints, and commit it.
# ---------------------------------------------------------------------------
FROM node:22-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee

# sharp ships prebuilt libvips binaries for linux x64/arm64 — no apt deps.
WORKDIR /app

# Match the workspace's pinned pnpm (root package.json "packageManager").
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Install deps first for layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
# node itself is PID 1 (not `pnpm start`): pnpm passed SIGTERM to its shell
# child only, so the worker's own shutdown (finish the images in hand, hand
# back the rest) never ran and claimed photographs stayed "Processing".
CMD ["node", "--import", "tsx", "src/worker.ts"]
