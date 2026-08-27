FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run content:verify-precomputed
EXPOSE 4177
CMD ["node", "server.mjs"]
