# syntax=docker/dockerfile:1.10

FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM deps AS builder
COPY prisma ./prisma
COPY tsconfig.json .
COPY src ./src
COPY README.md ./
RUN npm run prisma:generate && npm run build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/index.js"]
