# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# Run Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 빌드 결과물 복사
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
# next.config.ts 등 설정 파일도 필요할 수 있음
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/postcss.config.mjs ./

EXPOSE 3000

CMD ["npm", "start"]
