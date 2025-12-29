import os  # 폴더 만들기용
import shutil  # 파일 복사용
from uuid import UUID

import pymupdf4llm
from fastapi import UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk

# from utils.openai import get_embedding  # 추후 구현 필요


class IngestionService:
    def __init__(self, db: Session):
        self.db = db
        # 1. 청킹 전략 설정
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            # NOTE: 한국어 문서는 문맥 끊김을 방지하기 위해 마침표나 줄바꿈 처리가 중요
            separators=["\n\n", "\n", " ", ""],
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
        self, knowledge_base_id: UUID, filename: str, file_path: str
    ) -> UUID:
        """
        파일 업로드 시점에 'Pending' 상태의 Document 레코드를 먼저 생성합니다.
        KnowledgeBase와의 연결(FK)을 위해 knowledge_base_id가 필수입니다.
        """
        new_doc = Document(
            knowledge_base_id=knowledge_base_id,
            filename=filename,
            file_path=file_path,
            status="pending",
        )
        self.db.add(new_doc)
        self.db.commit()
        self.db.refresh(new_doc)
        return new_doc.id

    async def process_document_background(self, document_id: UUID, file_path: str):
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
            self._save_chunks_to_pgvector(document_id, chunks)

            self._update_status(document_id, "completed")
        except Exception as e:
            print(f"Ingestion failed: {e}")
            self._update_status(document_id, "failed")

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
        텍스트 블록을 청크로 분할합니다.
        """
        final_chunks = []
        for block in text_blocks:
            splits = self.text_splitter.split_text(block["text"])
            for split in splits:
                final_chunks.append(
                    {"content": split, "metadata": {"page": block["page"]}}
                )
        return final_chunks

    def _save_chunks_to_pgvector(self, document_id: UUID, chunks: list[dict]):
        """
        OpenAI API를 호출하여 임베딩을 생성하고 DocumentChunk 테이블에 저장합니다.
        """
        chunk_objects = []
        for chunk in chunks:
            # vector = get_embedding(chunk["content"])  # TODO: OpenAI API 호출 구현 필요
            vector = [0.0] * 1536  # Mock Vector

            db_chunk = DocumentChunk(
                document_id=document_id,
                content=chunk["content"],
                embedding=vector,
                metadata_=chunk["metadata"],
            )
            chunk_objects.append(db_chunk)

        self.db.add_all(chunk_objects)
        self.db.commit()

    def _update_status(self, document_id: UUID, status: str):
        doc = self.db.query(Document).get(document_id)
        if doc:
            doc.status = status
            self.db.commit()
