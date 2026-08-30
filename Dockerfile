FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run content:verify-precomputed
RUN npm run build
RUN npm prune --omit=dev
EXPOSE 4177
CMD ["node", "runner.mjs"]
