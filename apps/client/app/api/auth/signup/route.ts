import { NextRequest, NextResponse } from 'next/server';
import { SignupRequest } from '@/app/features/auth/types/auth';

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 본문 파싱
    const body: SignupRequest = await request.json();
    const { name, email, password } = body;

    // 2. 입력 검증
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 },
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 },
      );
    }

    // 비밀번호 길이 검증
    if (password.length < 8) {
      return NextResponse.json(
        { error: '비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 },
      );
    }

    // TODO: 3. 이메일 중복 확인
    // const existingUser = await db.user.findUnique({ where: { email } });
    // if (existingUser) {
    //   return NextResponse.json(
    //     { error: "이미 사용 중인 이메일입니다." },
    //     { status: 409 }
    //   );
    // }

    // TODO: 4. 비밀번호 해싱
    // import { hash } from "bcrypt";
    // const hashedPassword = await hash(password, 10);

    // TODO: 5. 사용자 생성
    // const user = await db.user.create({
    //   data: {
    //     name,
    //     email,
    //     emailVerified: false,
    //     role: "user",
    //     isActive: true,
    //   },
    // });

    // TODO: 6. Account 레코드 생성 (credential 방식)
    // await db.account.create({
    //   data: {
    //     userId: user.id,
    //     providerId: "credential",
    //     accountId: email,
    //     password: hashedPassword,
    //   },
    // });

    // 임시 응답 (실제로는 생성된 사용자 정보 반환)
    return NextResponse.json(
      {
        message: '회원가입이 완료되었습니다.',
        user: {
          id: 'temp-id',
          name,
          email,
          emailVerified: false,
          role: 'user',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
