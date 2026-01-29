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

    @abstractmethod
    def persist_content(self, content: str, file_ext: str = "md") -> str:
        """
        텍스트 콘텐츠(문자열)를 저장소에 영구 저장하고, 접근 키(Storage Key)를 반환합니다.

        Args:
            content: 저장할 텍스트 내용
            file_ext: 파일 확장자 (기본값: md)

        Returns:
            str: 나중에 retrieve_content로 조회할 수 있는 스토리지 키 (또는 경로)
        """
        pass

    @abstractmethod
    def retrieve_content(self, storage_key: str) -> str:
        """
        스토리지 키를 사용하여 저장된 텍스트 콘텐츠를 불러옵니다.

        Args:
            storage_key: persist_content에서 반환된 키

        Returns:
            str: 저장된 텍스트 내용
        """
        pass


class LocalStorageService(StorageService):
    def __init__(self, upload_dir: str = "/app/uploads"):  # 컨테이너에서 쓰기 가능
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

    def generate_presigned_upload_url(
        self,
        filename: str,
        content_type: str,
        user_id: str,
        expires_in: int = 3600,
    ) -> dict:
        """
        LocalStorage를 사용하는 경우 Presigned URL을 지원하지 않으므로,
        프론트엔드에서 직접 백엔드로 업로드하도록 유도하는 응답을 반환하거나,
        적절한 예외를 던져서 핸들링하도록 합니다.

        여기서는 None을 반환하여 프론트엔드가 일반 업로드를 수행하도록 합니다.
        (프론트엔드 로직에 따라 수정 필요할 수 있음)
        """
        # 로컬 모드에서는 Presigned URL 생성이 불가능
        # 프론트엔드가 이 응답을 보고 "일반 업로드"로 전환하도록 신호를 줍니다.
        return {"use_backend_proxy": True, "url": None, "key": None, "method": None}

    def persist_content(self, content: str, file_ext: str = "md") -> str:
        import hashlib

        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        filename = f"{content_hash}.{file_ext}"

        # 파싱된 파일은 별도 하위 디렉토리(parsed)에 격리
        save_dir = os.path.join(self.upload_dir, "parsed")
        os.makedirs(save_dir, exist_ok=True)

        file_path = os.path.join(save_dir, filename)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        return file_path

    def retrieve_content(self, storage_key: str) -> str:
        if not os.path.exists(storage_key):
            raise FileNotFoundError(f"Content not found at {storage_key}")

        with open(storage_key, "r", encoding="utf-8") as f:
            return f.read()


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

    def persist_content(self, content: str, file_ext: str = "md") -> str:
        import hashlib

        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        s3_key = f"parsed/{content_hash}.{file_ext}"

        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=content.encode("utf-8"),
                ContentType="text/markdown; charset=utf-8"
                if file_ext == "md"
                else "text/plain",
            )
        except Exception as e:
            logger.error(f"S3 Persist Content failed: {e}")
            raise e

        return s3_key

    def retrieve_content(self, storage_key: str) -> str:
        # S3 Key로 간주
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name, Key=storage_key
            )
            return response["Body"].read().decode("utf-8")
        except Exception as e:
            logger.error(f"S3 Retrieve Content failed: {e}")
            raise e


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
