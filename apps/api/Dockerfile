FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/astrology-core/package.json packages/astrology-core/package.json

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 4000

CMD ["pnpm", "--filter", "@astroprocessor/api", "dev"]
