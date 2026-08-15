# Single-origin image: the API serves both /api and the built React app, so a
# deployment needs one container and no CORS configuration.

# ── Stage 1: build the client ────────────────────────────────────────────────
FROM node:22-alpine AS client-build
WORKDIR /build/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
# Baked into the bundle at build time. Leave unset for the single-origin setup —
# the app then calls /api on its own host.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Stage 2: server dependencies ─────────────────────────────────────────────
FROM node:22-alpine AS server-deps
WORKDIR /build/server

COPY server/package*.json ./
# Production install only: mongodb-memory-server is a dev dependency and would
# otherwise download a MongoDB binary into the image.
RUN npm ci --omit=dev

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# dumb-init reaps zombies and forwards SIGTERM, so graceful shutdown works.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production \
    SERVE_CLIENT=true \
    CLIENT_DIST_PATH=/app/client/dist \
    PORT=8090

COPY --from=server-deps /build/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY --from=client-build /build/client/dist ./client/dist

# Run unprivileged; the node image ships a `node` user for exactly this.
RUN chown -R node:node /app
USER node

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8090)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/src/index.js"]
