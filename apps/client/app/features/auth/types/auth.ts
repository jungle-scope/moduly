/*
 * 인증 관련 TypeScript 타입 정의
 * DB 스키마와 일치하도록 작성
 */

// ==================== User 테이블 ====================
export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string;
  role: string; // 'admin' | 'user'
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ==================== Account 테이블 ====================
export interface Account {
  id: string;
  userId: string;
  providerId: string; // 'google' | 'github' | 'credential'
  accountId: string; // 해당 제공자 (구글 등)가 생성한 사용자 고유 ID
  password?: string; // 이메일 로그인 시에만 존재
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
}

// ==================== Session 테이블 ====================
export interface Session {
  id: string; // 세션 자체의 ID
  token: string; //
  userId: string; // 해당 세션을 소유한 사용자 ID
  expiresAt: string; // 세션 만료 시간
  createdAt: string;
  lastActiveAt?: string;
}

// ==================== Verification 테이블 ====================
export interface Verification {
  id: string;
  identifier: string; // 이메일 주소
  value: string; // 인증 토큰
  type: 'email_verification' | 'password_reset';
  expiresAt: string;
}

// ==================== API Request/Response 타입 ====================

// 로그인 요청
export interface LoginRequest {
  email: string;
  password: string;
}

// 로그인 응답
export interface LoginResponse {
  user: User;
  session: {
    token: string;
    expiresAt: string;
  };
}

// 회원가입 요청
export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

// 회원가입 응답
export interface SignupResponse {
  user: User;
  verification: {
    required: boolean;
    message: string;
  };
}

// 이메일 인증 요청
export interface VerifyEmailRequest {
  identifier: string;
  value: string;
}

// 비밀번호 재설정 요청
export interface PasswordResetRequest {
  email: string;
}

// 비밀번호 변경 요청
export interface PasswordChangeRequest {
  token: string;
  newPassword: string;
}

// 현재 사용자 정보 응답
export interface CurrentUserResponse {
  user: User;
  session: Session;
}

// ==================== 에러 응답 ====================
export interface AuthError {
  code: string;
  message: string;
  field?: string;
}
