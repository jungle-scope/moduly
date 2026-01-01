import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
};

export default nextConfig;
