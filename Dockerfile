FROM node:23-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate

RUN npm run build 2>&1 || true

FROM node:23-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next

# Fix potentially corrupted prerender manifest
RUN if [ ! -f .next/prerender-manifest.json ] || [ ! -s .next/prerender-manifest.json ]; then \
      mkdir -p .next && \
      printf '{"version":4,"routes":{},"dynamicRoutes":{},"notFoundRoutes":[],"preview":{"previewModeId":"","previewModeSigningSecret":"","previewModeEncryptionSecret":""}}' > .next/prerender-manifest.json; \
    fi

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001 || exit 1

CMD ["npm", "run", "start"]
