import os

import boto3


class BedrockIngestionService:
    def __init__(self):
        # AWS Client 초기화
        # 실제 운영 환경에서는 IAM Role을 사용하거나 ~/.aws/credentials를 사용하므로
        # 명시적인 키 제공 없이 boto3.client를 호출하는 것이 일반적입니다.
        self.s3_client = boto3.client("s3")
        self.bedrock_agent_client = boto3.client("bedrock-agent")

        # 환경 변수에서 설정 로드
        self.knowledge_base_id = os.getenv("AWS_BEDROCK_KB_ID")
        self.data_source_id = os.getenv("AWS_BEDROCK_DATA_SOURCE_ID")
        self.bucket_name = os.getenv("AWS_S3_BUCKET_NAME")

    def process_document(self, file_path: str, filename: str, document_id: str):
        """
        S3에 파일을 업로드하고 Bedrock Knowledge Base 동기화(Ingestion)를 트리거합니다.
        (UploadFile 대신 로컬 파일 경로를 받아서 백그라운드 처리 안정성 확보)
        """
        if (
            not self.bucket_name
            or not self.knowledge_base_id
            or not self.data_source_id
        ):
            raise ValueError(
                "AWS Configuration (KB_ID, DATA_SOURCE_ID, BUCKET_NAME) is missing."
            )

        # 1. S3 업로드
        # 구조화된 키 사용: documents/{doc_id}/{filename}
        s3_key = f"documents/{document_id}/{filename}"

        print(f"🚀 Uploading to S3: s3://{self.bucket_name}/{s3_key}")

        # 로컬 파일에서 읽어서 업로드
        with open(file_path, "rb") as data:
            self.s3_client.upload_fileobj(data, self.bucket_name, s3_key)

        # 2. Ingestion Job (Sync) 트리거
        # 주의: Bedrock KB는 데이터 소스 단위로 동기화하므로,
        # 빈번한 요청은 Throttling을 유발할 수 있습니다.
        print(f"🔄 Triggering Bedrock Ingestion Job for KB: {self.knowledge_base_id}")

        response = self.bedrock_agent_client.start_ingestion_job(
            knowledgeBaseId=self.knowledge_base_id,
            dataSourceId=self.data_source_id,
            description=f"Ingestion for document: {document_id}",
        )

        job_id = response["ingestionJob"]["ingestionJobId"]
        print(f"✅ Ingestion Job Started: {job_id}")

        return job_id
