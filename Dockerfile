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
EXPOSE 5000
USER node
CMD ["node", "server/index.js"]
