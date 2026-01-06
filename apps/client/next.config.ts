import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',

  async headers() {
    return [
      // 1. 임베딩 페이지: 어디서든 허용
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors http: https: file: data:',
          },
        ],
      },
      // 2. 공유 페이지: 어디서든 허용
      {
        source: '/shared/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors http: https: file: data:',
          },
        ],
      },
      // 3. [수정됨] 나머지 페이지: 임베딩 및 공유 페이지를 '제외한' 모든 경로
      // 정규식 설명: (?!embed|shared) -> embed나 shared로 시작하지 않는 모든 경로
      {
        source: '/((?!embed|shared).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
  async rewrites() {
    // 환경변수로 백엔드 URL 설정 (기본값: 로컬)
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    return [
      {
        source: '/api/:path*',
        // 로컬 개발: localhost:8000
        // 배포 테스트: .env.local에 BACKEND_URL 설정
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', //파일 업로드 제한 50mb
    },
    // 미들웨어 바디 사이즈 제한 50MB로 설정
    middlewareClientMaxBodySize: '50mb',
  },
};

export default nextConfig;
