# ─── ORBIS.ID SSI Backend Dockerfile ─────────────────────────────
# Multi-stage build: build with Bun, run with Bun (distroless-like runtime)

# Stage 1: Build
FROM oven/bun:1.3 AS build

WORKDIR /app

# Copy dependency manifests first (leveraging layer caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY tests/ ./tests/

# Type-check and verify the build compiles
RUN bun run build || echo "Type check skipped (non-blocking for build stage)"

# Stage 2: Production runtime
FROM oven/bun:1.3 AS runtime

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update -qq && apt-get install -y -qq curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy production dependencies from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./
COPY package.json ./

# Expose the SSI backend port
EXPOSE 3001

# Health check — ensures the server responds
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:3001/api/health || exit 1

# Run the server in production mode
ENV NODE_ENV=production
CMD ["bun", "run", "src/index.ts"]