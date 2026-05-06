# ======================
# Builder stage
# ======================
FROM node:24-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack (node 24 có sẵn)
RUN corepack enable

# Copy lockfile trước để tận dụng cache
COPY package.json pnpm-lock.yaml ./

# Cache pnpm store để build nhanh hơn
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build


# ======================
# Production stage
# ======================
FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Enable pnpm
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production deps only + cache
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

# Copy build output
COPY --from=builder /app/dist ./dist

# Migration files + entrypoint
COPY --from=builder /app/drizzle ./drizzle
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 4040

ENTRYPOINT ["./entrypoint.sh"]
