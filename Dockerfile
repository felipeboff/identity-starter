FROM node:24-slim AS base
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/

FROM base AS build
RUN pnpm install --frozen-lockfile --ignore-scripts --filter resolve-hub
COPY tsconfig.json ./
COPY src src
RUN pnpm build

FROM base AS production-dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts --prod --filter resolve-hub

FROM node:24-slim
WORKDIR /app
COPY package.json ./
COPY --from=production-dependencies /app/node_modules node_modules
COPY --from=build /app/dist dist
USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/main.js"]
