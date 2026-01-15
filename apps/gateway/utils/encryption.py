import os

from cryptography.fernet import Fernet  # type: ignore

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")


class EncryptionManager:
    """
    AES 방식으로 암호화/복호화하는 유틸리티 클래스입니다.
    """

    def __init__(self):
        self._cipher_suite = None

    @property
    def cipher_suite(self):
        # 환경변수 encryption_key lazy initialization
        if self._cipher_suite is None:
            key = os.getenv("ENCRYPTION_KEY")
            if not key:
                raise ValueError("환경 변수 ENCRYPTION_KEY가 설정되지 않았습니다.")
            self._cipher_suite = Fernet(key)
        return self._cipher_suite

    def encrypt(self, plain_text: str) -> str:
        """
        평문을 암호화해서 저장가능한 문자열로 반환합니다.
        """
        if not plain_text:
            return ""

        return self.cipher_suite.encrypt(plain_text.encode()).decode()

    def decrypt(self, encrypted_text: str) -> str:
        """
        암호화된 문자열을 평문으로 복호화합니다.
        """
        if not encrypted_text:
            return ""

        try:
            return self.cipher_suite.decrypt(encrypted_text.encode()).decode()
        except Exception as e:
            raise ValueError(f"복호화 실패: {str(e)}")  # 키가 다르거나 데이터가 손상됨


# 싱글톤처럼 어디서든 임포트해서 쓸 수 있도록 인스턴스 생성
# 사용법: from apps.server.utils.encryption import encryption_manager
encryption_manager = EncryptionManager()
