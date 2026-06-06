FROM node:20-alpine

# node:20-alpine already has node user/group; ensure /app and /data writable
WORKDIR /app

# Create /data directory for persistent storage and set ownership
RUN mkdir -p /data && chown -R node:node /app /data

# Switch to node user
USER node

# Install dependencies from the root workspace manifests.
# All workspace package.json files must be present (root "workspaces" lists them),
# but we scope the install to api + the shared codegen package to keep this image lean.
COPY --chown=node:node package*.json ./
COPY --chown=node:node packages/manim-codegen/package.json packages/manim-codegen/package.json
COPY --chown=node:node services/api/package.json services/api/package.json
COPY --chown=node:node services/web/package.json services/web/package.json
RUN npm install -w services/api -w packages/manim-codegen --include-workspace-root

# Copy sources (the shared package + the api service)
COPY --chown=node:node packages/manim-codegen packages/manim-codegen
COPY --chown=node:node services/api services/api

EXPOSE 3000

CMD ["npm", "--workspace", "services/api", "run", "dev"]
