# 1. Dify 공식 샌드박스 이미지 사용
FROM langgenius/dify-sandbox:0.2.12

# 2. 한국 시간대(KST) 설정
ENV TZ=Asia/Seoul
RUN apt-get update && apt-get install -y tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 8194