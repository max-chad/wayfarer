# syntax=docker/dockerfile:1
# Production image for Wayfarer. The SQLite database lives on the /data volume and seeds itself on first start.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Toolchain for better-sqlite3 in case no prebuilt binary matches the platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATABASE_PATH=/data/wayfarer.db
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/data/source ./data/source
COPY --from=build /app/data/generated ./data/generated
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /data && chown -R node:node /data /app/.next
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/run-next.cjs", "start", "-p", "3000"]
