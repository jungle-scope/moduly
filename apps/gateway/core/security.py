import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class SecurityService:
    _instance = None
    _aesgcm = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SecurityService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        master_key_b64 = os.getenv("MASTER_KEY")
        if not master_key_b64:
            raise ValueError("MASTER_KEY must be set in environment variables")

        try:
            # Base64로 인코딩된 키를 디코딩합니다.
            key = base64.b64decode(master_key_b64)
            if len(key) != 32:
                # 32바이트(256비트)가 아니면 에러를 발생시킵니다.
                raise ValueError(
                    f"MASTER_KEY must be 32 bytes (256 bits) for AES-256. Current length: {len(key)}"
                )

            self._aesgcm = AESGCM(key)
        except Exception as e:
            raise ValueError(f"Invalid MASTER_KEY: {e}")

    def encrypt(self, plaintext: str) -> str:
        """
        AES-256-GCM 암호화
        반환값: (nonce + 암호문 + 태그)를 Base64로 인코딩한 문자열
        """
        if not plaintext:
            return ""

        nonce = os.urandom(12)  # GCM에 권장되는 nonce 크기
        data = plaintext.encode("utf-8")
        ciphertext = self._aesgcm.encrypt(nonce, data, None)

        # nonce와 암호문을 결합합니다 (태그는 암호문에 포함되어 있음)
        return base64.b64encode(nonce + ciphertext).decode("utf-8")

    def decrypt(self, encrypted_text: str) -> str:
        """
        AES-256-GCM 복호화
        입력값: (nonce + 암호문 + 태그)가 Base64로 인코딩된 문자열
        """
        if not encrypted_text:
            return ""

        try:
            full_data = base64.b64decode(encrypted_text)
            nonce = full_data[:12]
            ciphertext = full_data[12:]

            plaintext = self._aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode("utf-8")
        except Exception:
            # 복호화 실패 (잘못된 키, 변조된 데이터 등)
            raise ValueError("Decryption failed")


# 전역 인스턴스
security_service = SecurityService()
