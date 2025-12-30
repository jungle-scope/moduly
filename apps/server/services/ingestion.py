import os  # 폴더 만들기용
import shutil  # 파일 복사용
from uuid import UUID

import pymupdf4llm
import tiktoken
from fastapi import UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk

# from utils.openai import get_embedding  # 추후 구현 필요


class IngestionService:
    def __init__(
        self,
        db: Session,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        ai_model: str = "text-embedding-3-small",
    ):
        self.db = db
        self.ai_model = ai_model

        # 청킹 전략 설정
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            # 문단 바뀔 때, 줄 바꿀 때, 마침표, 띄어쓰기일 때 자른다
            separators=["\n\n", "\n", ".", " ", ""],
            keep_separator=True,
        )

    def save_temp_file(self, file: UploadFile) -> str:
        """
        설명: 메모리에 있는 업로드 파일을 디스크(uploads 폴더)에 저장합니다.
        """

        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)

        # 저장될 파일의 전체 주소 (예: "uploads/보고서.pdf")
        file_path = os.path.join(upload_dir, file.filename)

        with open(file_path, "wb") as buffer:
            # 메모리에 있는 파일(file.file)을 하드디스크(buffer)로 복사
            shutil.copyfileobj(file.file, buffer)

        return file_path

    def create_pending_document(
        self,
        knowledge_base_id: UUID,
        filename: str,
        file_path: str,
        chunk_size: int,
        chunk_overlap: int,
    ) -> UUID:
        """
        파일 업로드 시점에 'Pending' 상태의 Document 레코드를 먼저 생성합니다.
        KnowledgeBase와의 연결(FK)을 위해 knowledge_base_id가 필수입니다.
        설정된 chunk_size와 chunk_overlap을 저장하여 나중에 참조할 수 있게 합니다.
        """
        new_doc = Document(
            knowledge_base_id=knowledge_base_id,
            filename=filename,
            file_path=file_path,
            status="pending",
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        self.db.add(new_doc)
        self.db.commit()
        self.db.refresh(new_doc)
        return new_doc.id

    async def process_document_background(
        self, document_id: UUID, knowledge_base_id: UUID, file_path: str
    ):
        """
        BackgroundTasks의 메인 진입점.
        파싱 -> 청킹 -> 임베딩 -> 저장 과정을 조율합니다.
        """
        try:
            self._update_status(document_id, "indexing")

            # 1단계: 파싱 (LangChain Loader 사용)
            text_blocks = self._parse_pdf(file_path)

            # 2단계: 청킹
            chunks = self._create_chunks(text_blocks)

            # 3 & 4단계: 임베딩 및 저장
            self._save_chunks_to_pgvector(document_id, knowledge_base_id, chunks)

            self._update_status(document_id, "completed")
        except Exception as e:
            print(f"Ingestion failed: {e}")
            self._update_status(document_id, "failed", error_message=str(e))

    def _parse_pdf(self, file_path: str) -> list[dict]:
        """
        PDF 파일을 읽어서 마크다운 형식으로 바꿔주는 내부 함수
        """
        # page_chunks=True: 페이지별로 분리해서 메타데이터와 함께 반환
        # 결과(md_text_chunks)는 [{'text': '...', 'metadata': {...}}, ...] 형태의 리스트가 된다
        md_text_chunks = pymupdf4llm.to_markdown(file_path, page_chunks=True)

        results = []
        for chunk in md_text_chunks:
            results.append(
                {
                    "text": chunk["text"],  # 마크다운 텍스트
                    "page": chunk["metadata"]["page"] + 1,
                }
            )
        return results

    def _create_chunks(self, text_blocks: list[dict]) -> list[dict]:
        """
        파싱된 텍스트를 더 작은 조각(Chunk)으로 나눕니다.
        """
        final_chunks = []

        for block in text_blocks:
            splits = self.text_splitter.split_text(block["text"])
            for split in splits:
                final_chunks.append(
                    {"content": split, "metadata": {"page": block["page"]}}
                )
        return final_chunks

    def _save_chunks_to_pgvector(
        self, document_id: UUID, knowledge_base_id: UUID, chunks: list[dict]
    ):
        """
        텍스트 조각들을 OpenAI에 보내서 '의미 벡터'로 바꾼 뒤, DocumentChunk 테이블에 저장합니다.
        """
        # 토큰 계산을 위한 인코더 설정
        try:
            encoding = tiktoken.encoding_for_model(self.ai_model)
        except KeyError:
            encoding = tiktoken.get_encoding("cl100k_base")  # gpt-4로 가정하고 계산

        # DB에서 API Key 가져오기 (환경변수 의존 제거)
        from services.llm_service import LLMService

        api_key = LLMService.get_default_api_key(self.db)

        # 임베딩 모델 초기화 (API Key 명시)
        embeddings_model = OpenAIEmbeddings(model=self.ai_model, openai_api_key=api_key)

        # 1. 텍스트 추출 (배치 처리를 위해)
        texts = [chunk["content"] for chunk in chunks]

        # 2. 임베딩 생성 (일괄 호출) - 실제 API 사용!
        try:
            embedded_vectors = embeddings_model.embed_documents(texts)
        except Exception as e:
            print(f"OpenAI Embedding Error: {e}")
            raise e

        # 3. DB 객체 생성
        chunk_objects = []
        for i, chunk in enumerate(chunks):
            content = chunk["content"]
            token_count = len(encoding.encode(content))

            db_chunk = DocumentChunk(
                document_id=document_id,
                knowledge_base_id=knowledge_base_id,  # 검색 최적화용
                content=content,
                embedding=embedded_vectors[i],
                chunk_index=i,
                token_count=token_count,
                metadata_=chunk["metadata"],
            )
            chunk_objects.append(db_chunk)

        self.db.add_all(chunk_objects)
        self.db.commit()

    def _update_status(self, document_id: UUID, status: str, error_message: str = None):
        doc = self.db.query(Document).get(document_id)
        if doc:
            doc.status = status
            if error_message:
                doc.error_message = error_message
            self.db.commit()
