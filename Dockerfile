# ─── ORBIS.ID SSI Backend Dockerfile ─────────────────────────────
# Multi-stage build: build with Bun, run with Bun

# Stage 1: Install dependencies
FROM oven/bun:1.3 AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN bun install --production

# Stage 2: Production runtime
FROM oven/bun:1.3 AS runtime

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update -qq && apt-get install -y -qq curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy production dependencies from build stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/

# Expose the SSI backend port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:3001/api/health || exit 1

# Run the server in production mode
ENV NODE_ENV=production
CMD ["bun", "run", "src/index.ts"]
