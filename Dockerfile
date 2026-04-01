FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/index.js ./server/index.js
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
USER node
CMD ["node", "server/index.js"]
