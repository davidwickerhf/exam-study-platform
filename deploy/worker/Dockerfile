FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production CANVAS_CORPUS_ASSET_DIR=/tmp/corpus-assets
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr unzip && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib ./lib
COPY scripts ./scripts
COPY db ./db
COPY data ./data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/healthz').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "scripts/canvas-corpus-worker.mjs"]
