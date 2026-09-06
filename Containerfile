FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production WICKER_SERVICE=api CANVAS_CORPUS_WORKER=off
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr unzip && rm -rf /var/lib/apt/lists/*
COPY deploy/runtime/package.json deploy/runtime/package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs runner.mjs ./
COPY lib ./lib
COPY scripts ./scripts
COPY db ./db
COPY data ./data
COPY .claude/skills/wicker-study ./.claude/skills/wicker-study
EXPOSE 8080
CMD ["node", "runner.mjs"]
