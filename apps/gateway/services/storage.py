import logging
import os
import shutil
import uuid
from abc import ABC, abstractmethod

import boto3
from fastapi import UploadFile

from apps.gateway.core.config import settings

logger = logging.getLogger(__name__)


class StorageService(ABC):
    @abstractmethod
    def upload(self, file: UploadFile) -> str:
        """
        파일을 저장소에 업로드하고 접근 경로(또는 키)를 반환합니다.
        """
        pass

    @abstractmethod
    def delete(self, file_path: str):
        """
        저장소에서 파일을 삭제합니다.
        """
        pass


class LocalStorageService(StorageService):
    def __init__(self, upload_dir: str = "/tmp/uploads"):  # 컨테이너에서 쓰기 가능
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload(self, file: UploadFile) -> str:
        # 안전한 파일명 생성
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = os.path.join(self.upload_dir, unique_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 포인터 초기화 (다른 곳에서 다시 읽을 수 있도록)
        file.file.seek(0)

        return file_path

    def delete(self, file_path: str):
        if os.path.exists(file_path):
            os.remove(file_path)


class S3StorageService(StorageService):
    def __init__(self):
        self.bucket_name = settings.S3_BUCKET_NAME
        self.region = settings.AWS_REGION
        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=self.region,
        )

        if not self.bucket_name:
            raise ValueError("S3_BUCKET_NAME is not set. ")

    def upload(self, file: UploadFile) -> str:
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        s3_key = f"uploads/{unique_filename}"

        try:
            self.s3_client.upload_fileobj(
                file.file,
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    "ContentType": file.content_type or "application/octet-stream",
                    "ContentDisposition": "inline",
                },
            )
        except Exception as e:
            logger.error(f"S3 Upload failed: {e}")
            raise e
        finally:
            # 포인터 초기화
            try:
                file.file.seek(0)
            except ValueError:
                # 이미 닫힌 파일인 경우 무시
                pass

        # S3 URL
        return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"

    def generate_presigned_upload_url(
        self,
        filename: str,
        content_type: str,
        user_id: str,
        expires_in: int = 3600,  # 1시간 유효
    ) -> dict:
        """
        S3 Presigned URL 생성 (프론트엔드 직접 업로드용)

        Args:
            filename: 원본 파일명
            content_type: MIME 타입 (예: application/pdf)
            user_id: 사용자 ID (폴더 분리용)
            expires_in: URL 유효 시간 (초)

        Returns:
            dict: {
                "url": Presigned URL,
                "key": S3 key,
                "method": "PUT"
            }
        """
        # 고유한 파일명 생성 (충돌 방지)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        s3_key = f"uploads/{user_id}/{unique_filename}"

        try:
            # Presigned URL 생성 (PUT 방식)
            presigned_url = self.s3_client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": s3_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )

            return {
                "url": presigned_url,
                "key": s3_key,
                "method": "PUT",
            }
        except Exception as e:
            logger.error(f"Presigned URL generation failed: {e}")
            raise e

    def delete(self, file_path: str):
        key = file_path

        if file_path.startswith("s3://"):
            parts = file_path.replace("s3://", "").split("/", 1)
            if len(parts) > 1:
                key = parts[1]
        elif file_path.startswith("http"):
            # https://bucket.s3.region.amazonaws.com/folder/file.ext -> folder/file.ext
            # URL 파싱 대신 단순히 버킷명 뒷부분을 추출하거나, 표준 S3 URL 패턴 매칭
            # 간단하게 마지막 path 부분만 가져오는건 위험하므로(폴더 구조), 도메인 이후 path 추출
            from urllib.parse import urlparse

            parsed = urlparse(file_path)
            # path: /key or /bucket/key (virtual hosted)
            # 여기서는 virtual hosted style을 가정하고 key 추출
            key = parsed.path.lstrip("/")

            # 혹시 path에 bucket 이름이 중복되어 들어가 있다면 제거 (Legacy 호환)
            # 예: /my-bucket/uploads/file.pdf -> uploads/file.pdf
            if key.startswith(f"{self.bucket_name}/"):
                key = key.replace(f"{self.bucket_name}/", "", 1)

        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
        except Exception as e:
            logger.error(f"S3 Delete failed: {e}")


def get_storage_service() -> StorageService:
    # 환경변수가 없거나 None일 경우 기본값 LOCAL로 처리
    mode = (settings.STORAGE_TYPE or "LOCAL").upper()

    if mode == "LOCAL":
        return LocalStorageService()
    elif mode == "CLOUD":
        return S3StorageService()
    else:
        # 지원되지 않는 모드인 경우 경고 후 기본값(LOCAL) 사용
        logger.warning(f"Unknown STORAGE_TYPE '{mode}', falling back to LOCAL")
        return LocalStorageService()
