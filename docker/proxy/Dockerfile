# 1. 깔끔하게 ubuntu 최신 버전에서 시작 (중복 방지)
FROM ubuntu:latest

# 2. 시간대 및 필수 패키지 설치
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && apt-get update && apt-get install -y squid && rm -rf /var/lib/apt/lists/*

# 3. 설정 파일 복사 (소유권 바로 지정)
COPY --chown=proxy:proxy docker/proxy/squid.conf /etc/squid/squid.conf

# 4. [핵심] 권한 및 로그 연결 설정
# - PID 폴더와 로그 폴더를 proxy 유저가 쓸 수 있게 만듭니다.
# - 로그 파일을 표준 출력/에러로 연결합니다.
RUN mkdir -p /var/log/squid /var/run/squid \
    && chown -R proxy:proxy /var/log/squid /var/run/squid \
    && ln -sf /dev/stdout /var/log/squid/access.log \
    && ln -sf /dev/stderr /var/log/squid/cache.log

# 5. [중요] 실행 유저 전환
# 이 명령어가 없으면 root로 실행되어 아까와 같은 권한 충돌이 날 수 있습니다.
USER proxy

# 6. 포트 명시
EXPOSE 3128

# 7. 실행 명령어
# -N: 데몬화 방지(도커 필수), -d 1: 로그 레벨
CMD ["squid", "-N", "-d", "1", "-f", "/etc/squid/squid.conf"]