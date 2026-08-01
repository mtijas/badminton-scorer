FROM node:22.13-alpine
WORKDIR /app
RUN npm install --global pnpm@11.9.0
COPY package*.json ./
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY tsconfig.base.json ./
RUN pnpm --filter @badminton-scorer/api build
EXPOSE 3000
CMD ["pnpm", "--filter", "@badminton-scorer/api", "start"]
