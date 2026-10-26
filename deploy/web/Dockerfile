# Web image for self-hosting (Coolify): native Next.js on plain Node.
# The same image runs the pg-boss worker (`node scripts/worker.mjs`).
# The API service keeps its own image (../../Containerfile).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
# Next compiles rewrites into the build output, so the API address is a build
# argument. Every page renders dynamically; auth settings are read at runtime.
ARG WICKER_API_SERVICE_URL=http://api:8080
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 WICKER_API_SERVICE_URL=$WICKER_API_SERVICE_URL
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
# `next start` honours PORT and HOSTNAME.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
