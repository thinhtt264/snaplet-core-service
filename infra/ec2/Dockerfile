# Build config thuộc infra/ec2; context = repo root (để COPY thấy package.json, src/)
# ======================
# Builder stage
# ======================
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ======================
# Production stage
# ======================
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

EXPOSE 4040

CMD ["node", "dist/src/main.js"]
