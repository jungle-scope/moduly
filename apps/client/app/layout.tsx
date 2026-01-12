import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Moduly',
  description: 'Create your LLM Application with Moduly!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        {/*
          <Toaster />: 토스트 메시지를 보여줄 "스피커" 역할의 컴포넌트입니다.
          앱의 최상위(Layout)에 미리 설치해두면, 하위 컴포넌트 어디서든 
          toast.success() 등의 함수("방송")를 호출했을 때 이곳을 통해 알림창이 나타납니다.
        */}
        <Toaster />
      </body>
    </html>
  );
}
