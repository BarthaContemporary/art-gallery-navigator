# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# @jvb/image-worker — built by infra/compose/docker-compose.yml with
# `build: ../image-worker`, so the build context is this directory only
# (standalone; no workspace files are needed inside the image).
#
# NOTE on tsx: we deliberately keep `tsx` in "dependencies" (not
# devDependencies) and run the TypeScript source directly with `tsx` instead
# of compiling with tsc. That lets this image do a production-only install
# (`pnpm install --prod`) and still have its runtime available — a tsc build
# stage would add complexity for zero benefit in a single small worker.
# `pnpm typecheck` in CI keeps the types honest.
# ---------------------------------------------------------------------------
FROM node:22-slim

# sharp ships prebuilt libvips binaries for linux x64/arm64 — no apt deps.
WORKDIR /app

# Match the workspace's pinned pnpm (root package.json "packageManager").
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Install deps first for layer caching. No lockfile is committed for this
# package (it is installed standalone, outside the workspace graph).
COPY package.json ./
RUN pnpm install --prod

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
CMD ["pnpm", "start"]
