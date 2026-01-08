# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

# 패키지 설치
COPY apps/client/package*.json ./
RUN npm ci

# --- Stage 2: Builder ---
FROM node:20-alpine AS builder
WORKDIR /app

# Build argument for API URL (optional - defaults to next.config.ts value if not set)
ARG NEXT_PUBLIC_API_URL

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules
COPY apps/client .

# Next.js standalone 빌드
ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# --- Stage 3: Runner ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 보안: non-root 사용자
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone 파일만 복사
COPY --from=builder /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Public 파일 복사 (standalone이 처리 안 하면)
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
CMD ["node", "server.js"]
