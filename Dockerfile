FROM node:22-bookworm-slim AS build

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci

COPY . .
RUN python3 -m venv /opt/verifier-venv \
    && /opt/verifier-venv/bin/pip install --no-cache-dir -r verifier/requirements.txt
ENV PATH="/opt/verifier-venv/bin:$PATH"

# This is the same production build gate used outside Docker: source/package
# contracts, TypeScript, Next standalone output, and the isolated full verifier E2E.
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl python3 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PATH="/opt/verifier-venv/bin:$PATH"
WORKDIR /app

COPY --from=build /opt/verifier-venv /opt/verifier-venv
COPY --from=build /app /app

EXPOSE 8080
CMD ["npm", "run", "start"]
