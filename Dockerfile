# NEXORA / CampusCast — single image: API + built CMS + TV player on one port (5000)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY public ./public
COPY src/assets ./src/assets
# uploads must be writable by the unprivileged user (also when mounted as a named volume)
RUN mkdir -p server/uploads && chown -R node:node /app/server/uploads
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health >/dev/null || exit 1
CMD ["node", "server/index.js"]
