FROM node:23-alpine AS builder

# Declared before FROM so the value is available to `FROM` itself; must be
# redeclared in each stage that uses it (https://docs.docker.com/reference/dockerfile/#2).
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# `next build` runs here, and `NEXT_PUBLIC_*` values are inlined into the client
# bundle at build time. Without this the build dies with
# "@clerk/clerk-react: Missing publishableKey" the moment it prerenders a page
# under the root layout's <ClerkProvider> (app/layout.tsx:32).
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npx prisma generate

# Fail the build if `next build` fails. Swallowing the error here (previously
# `|| true`) shipped a partial .next directory that only blew up at runtime as a
# crash loop. Verify the expected output instead of trusting the exit code.
RUN npm run build && test -f .next/BUILD_ID && test -d .next/server

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

# Keep this URL on the same port as ENV PORT above; `next start` binds to $PORT.
# Probes /api/health rather than / because unauthenticated / is redirected to
# /sign-in by middleware.ts, and busybox wget does not follow redirects.
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["npm", "run", "start"]
