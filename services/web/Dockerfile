# Dependencies stage (used by both dev and production)
FROM node:20-alpine AS deps

WORKDIR /app

# Install from the root workspace manifests (all must be present for the
# "workspaces" globs); scope to web + the shared codegen package.
COPY package*.json ./
# Shared strict-TS base config — services/web/tsconfig.json `extends` it, and vite's
# esbuild transform resolves that `extends` during `vite build`, so it must be present.
COPY tsconfig.base.json ./
COPY packages/manim-codegen/package.json packages/manim-codegen/package.json
COPY services/api/package.json services/api/package.json
COPY services/web/package.json services/web/package.json
RUN npm install -w services/web -w packages/manim-codegen --include-workspace-root

# Copy sources (shared package + web service)
COPY packages/manim-codegen packages/manim-codegen
COPY services/web services/web

# Build stage (production)
FROM deps AS build

RUN npm --workspace services/web run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/services/web/dist /usr/share/nginx/html

# Copy nginx config
COPY services/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
