FROM node:24-bookworm-slim

WORKDIR /app

ENV pnpm_config_store_dir=/pnpm/store

RUN corepack enable && corepack prepare pnpm@12.20.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173
CMD ["pnpm", "--filter", "@carmela/web", "exec", "vite", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
