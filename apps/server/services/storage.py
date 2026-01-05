import os
import shutil
import uuid
from abc import ABC, abstractmethod

import boto3
from fastapi import UploadFile

from core.config import settings


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
    def __init__(self, upload_dir: str = "uploads"):
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

    def upload(self, file: UploadFile) -> str:
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        s3_key = f"uploads/{unique_filename}"

        try:
            self.s3_client.upload_fileobj(
                file.file,
                self.bucket_name,
                s3_key,
                # ExtraArgs={"ContentType": file.content_type} # 필요시 추가
            )
        except Exception as e:
            print(f"[ERROR] S3 Upload failed: {e}")
            raise e
        finally:
            # 포인터 초기화
            file.file.seek(0)

        # S3 Key 반환 (또는 s3:// URL)
        return f"s3://{self.bucket_name}/{s3_key}"

    def delete(self, file_path: str):
        # file_path format: s3://bucket/key or just key
        if file_path.startswith("s3://"):
            # s3://bucket/key -> key 추출
            parts = file_path.replace("s3://", "").split("/", 1)
            if len(parts) > 1:
                key = parts[1]
            else:
                return  # 잘못된 포맷
        else:
            key = file_path

        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
        except Exception as e:
            print(f"[ERROR] S3 Delete failed: {e}")


def get_storage_service() -> StorageService:
    mode = settings.RAG_INGESTION_MODE.upper()
    if mode == "LOCAL":
        print("[Storage] Initializing Local Storage (uploads/)")
        return LocalStorageService()
    else:
        print(f"[Storage] Initializing S3 Storage ({settings.S3_BUCKET_NAME})")
        return S3StorageService()
