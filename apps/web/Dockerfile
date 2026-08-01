FROM node:22.13-alpine
WORKDIR /app
RUN npm install --global pnpm@11.9.0
COPY package*.json ./
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
COPY packages/shared packages/shared
COPY tsconfig.base.json ./
EXPOSE 5173
CMD ["pnpm", "--filter", "@badminton-scorer/web", "dev"]
