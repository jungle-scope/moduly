from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    pydantic-settings의 BaseSettings 클래스를 상속합니다.
    이 클래스를 상속받아 설정 모델을 정의하면, 환경 변수나 .env 파일의 값을 자동으로 읽어와서 Python 타입으로 변환 및 검증을 수행합니다.
    """

    # RAG Ingestion Mode
    RAG_INGESTION_MODE: str = "DEV"

    # AWS Settings
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None

    # Load from .env file
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )


settings = Settings()
