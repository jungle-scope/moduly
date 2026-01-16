FROM nginx:alpine

# Nginx 설정 파일 복사
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80
