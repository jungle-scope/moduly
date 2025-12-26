import { NextRequest, NextResponse } from 'next/server';
import { LoginRequest } from '@/app/features/auth/types/auth';

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 본문 파싱
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // 2. 입력 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 모두 입력해주세요.' },
        { status: 400 },
      );
    }

    // TODO: 3. 사용자 조회
    // const user = await db.user.findUnique({
    //   where: { email },
    //   include: { accounts: true }
    // });
    //
    // if (!user) {
    //   return NextResponse.json(
    //     { error: "이메일 또는 비밀번호가 잘못되었습니다." },
    //     { status: 401 }
    //   );
    // }

    // TODO: 4. 비밀번호 검증
    // import { compare } from "bcrypt";
    // const account = user.accounts.find(acc => acc.providerId === "credential");
    // if (!account || !account.password) {
    //   return NextResponse.json(
    //     { error: "이메일 또는 비밀번호가 잘못되었습니다." },
    //     { status: 401 }
    //   );
    // }
    //
    // const isValid = await compare(password, account.password);
    // if (!isValid) {
    //   return NextResponse.json(
    //     { error: "이메일 또는 비밀번호가 잘못되었습니다." },
    //     { status: 401 }
    //   );
    // }

    // TODO: 5. 세션 생성
    // const session = await db.session.create({
    //   data: {
    //     userId: user.id,
    //     token: generateToken(),
    //     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일
    //   },
    // });

    // TODO: 6. 쿠키 설정
    // const response = NextResponse.json({
    //   user: {
    //     id: user.id,
    //     name: user.name,
    //     email: user.email,
    //     role: user.role,
    //   },
    //   session: {
    //     token: session.token,
    //     expiresAt: session.expiresAt,
    //   },
    // });
    //
    // response.cookies.set("session_token", session.token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "lax",
    //   maxAge: 7 * 24 * 60 * 60, // 7일
    // });
    //
    // return response;

    // 임시 응답
    return NextResponse.json(
      {
        message: '로그인 성공',
        user: {
          id: 'temp-id',
          email,
          name: 'Test User',
          role: 'user',
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
