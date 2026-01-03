import hashlib
import json
import os  # 폴더 만들기용
import re
import shutil  # 파일 복사용
from enum import Enum
from uuid import UUID

import tiktoken
from fastapi import UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk, SourceType
from db.models.llm import LLMCredential
from services.data_sources import ApiDataSource, BaseDataSource, FileDataSource


class ParsingStrategy(str, Enum):
    TEXT = "text"
    MIXED = "mixed"
    IMAGE = "image"


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

    def _get_data_source(self, source_type: str) -> BaseDataSource:
        if source_type == SourceType.FILE:
            return FileDataSource()
        elif source_type == SourceType.API:
            return ApiDataSource()
        # Default fallback for legacy data or if source_type is string "FILE"
        if str(source_type) == "FILE":
            return FileDataSource()
        raise ValueError(f"Unknown source type: {source_type}")

    def save_temp_file(self, file: UploadFile) -> str:
        """
        설명: 메모리에 있는 업로드 파일을 디스크(uploads 폴더)에 저장합니다.
        동일한 파일명이 업로드되어도 물리적 충돌을 방지하기 위해 UUID를 붙여서 저장합니다.
        """
        import uuid

        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)

        # 고유한 파일명 생성 (예: a1b2c3d4..._보고서.pdf)
        unique_filename = f"{uuid.uuid4()}_{file.filename}"

        # 저장될 파일의 전체 주소 (예: "uploads/a1b2c3d4..._보고서.pdf")
        file_path = os.path.join(upload_dir, unique_filename)

        with open(file_path, "wb") as buffer:
            # 메모리에 있는 파일(file.file)을 하드디스크(buffer)로 복사
            shutil.copyfileobj(file.file, buffer)

        return file_path

    def create_pending_document(
        self,
        knowledge_base_id: UUID,
        filename: str,
        file_path: str | None,
        chunk_size: int,
        chunk_overlap: int,
        source_type: SourceType = SourceType.FILE,
        meta_info: dict = None,
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
            source_type=source_type,
            meta_info=meta_info or {},
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
        파싱 -> 청킹 -> 임베딩 -> 저장
        """
        try:
            self._update_status(document_id, "indexing")
            self._update_progress(document_id, 5, "문서 처리를 시작합니다...")
            print("[DEBUG] 1번")
            # 1단계: 파싱 (document_id 전달)
            self._update_progress(document_id, 10, "문서 내용을 분석하고 있습니다...")

            # 1.3 DataSource를 통한 텍스트 추출
            # DB에서 Document 객체 조회
            doc = self.db.query(Document).get(document_id)
            if not doc:
                raise ValueError(f"Document {document_id} not found")

            data_source = self._get_data_source(doc.source_type)
            print("[DEBUG] 2번", data_source)

            # 소스 설정 구성
            source_config = {}
            if doc.source_type == SourceType.FILE or str(doc.source_type) == "FILE":
                source_config = {
                    "file_path": file_path,
                    "document_id": str(document_id),
                }
            elif doc.source_type == SourceType.API:
                # meta_info에서 API 설정 가져오기
                api_config = doc.meta_info.get("api_config", {})

                # 헤더 복호화 로직
                import json

                from core.security import security_service

                headers = api_config.get("headers")
                if headers and isinstance(headers, str):
                    try:
                        decrypted_json = security_service.decrypt(headers)
                        api_config["headers"] = json.loads(decrypted_json)
                    except Exception as e:
                        print(f"Failed to decrypt headers: {e}")
                        # 복호화 실패 시 빈 딕셔너리 사용하거나 에러 처리
                        api_config["headers"] = {}

                source_config = api_config

            text_blocks = data_source.fetch_text(source_config)

            # 파싱 결과가 비어있다면 (비용 승인 대기 등) 중단
            if not text_blocks:
                doc = self.db.query(Document).get(document_id)
                if doc and doc.status == "waiting_for_approval":
                    print(f"⏸️ Document {document_id} paused for approval.")
                    self._update_progress(
                        document_id, 0, "추가 비용 승인이 필요하여 대기 중입니다."
                    )
                    return
                # 진짜 내용이 없는 경우일 수도 있음 (이 경우 completed 처리됨)
                print(f"⚠️ No text extracted from document {document_id}")
                self._update_status(document_id, "completed")
                return

            # 1.5 Content Hash Check (변경 감지)
            # 모든 텍스트를 합쳐서 해시 생성
            full_text = "".join([b["text"] for b in text_blocks])
            new_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()

            if doc.content_hash == new_hash:
                print(f"⏭️ Content unchanged for {document_id}. Skipping processing.")
                self._update_progress(
                    document_id, 100, "변경된 내용이 없어 처리를 건너뜁니다."
                )
                self._update_status(document_id, "completed")
                return

            # 해시 업데이트
            doc = self.db.query(Document).get(document_id)
            if doc:
                doc.content_hash = new_hash
                self.db.commit()

            self._update_progress(document_id, 40, "문서 내용 분석이 완료되었습니다.")

            # 2~4단계: 청킹, 임베딩, 저장 및 완료 처리
            self._finalize_ingestion(document_id, knowledge_base_id, text_blocks)
        except Exception as e:
            print(f"Ingestion failed: {e}")
            self._update_status(document_id, "failed", error_message=str(e))
            self._update_progress(
                document_id, 0, f"처리 중 오류가 발생했습니다: {str(e)}"
            )

    async def resume_processing(self, document_id: UUID, strategy: str = "llamaparse"):
        """
        승인된 문서에 대해 파싱을 재개합니다.
        strategy: 'llamaparse' (유료, 고품질) or 'general' (무료, PyMuPDF)
        """
        doc = self.db.query(Document).get(document_id)
        if not doc:
            print(f"❌ Document {document_id} not found for resumption.")
            return

        try:
            print(f"▶️ Resuming ingestion for {document_id} with strategy: {strategy}")
            self._update_status(document_id, "indexing")

            text_blocks = []

            # 1단계: 전략에 따른 파싱 (DataSource 사용)
            data_source = self._get_data_source(doc.source_type)

            source_config = {}
            if doc.source_type == SourceType.FILE:
                source_config = {
                    "file_path": doc.file_path,
                    "document_id": str(document_id),
                    "strategy": strategy,  # "general" or "llamaparse" passed from arg
                }
            elif doc.source_type == SourceType.API:
                api_config = doc.meta_info.get("api_config", {})
                source_config = api_config

            text_blocks = data_source.fetch_text(source_config)

            # 2~4단계: 청킹, 임베딩, 저장 및 완료 처리
            self._finalize_ingestion(document_id, doc.knowledge_base_id, text_blocks)

        except Exception as e:
            print(f"❌ Resumption failed: {e}")
            self._update_status(document_id, "failed", error_message=str(e))

    def _save_chunks_to_pgvector(
        self, document_id: UUID, knowledge_base_id: UUID, chunks: list[dict]
    ):
        """
        텍스트 조각들을 OpenAI에 보내서 '의미 벡터'로 바꾼 뒤, DocumentChunk 테이블에 저장합니다.
        기존 청크가 있다면 삭제하고 새로 저장합니다 (Clean & Insert).
        """
        print(f"🔍 [Debug] _save_chunks_to_pgvector 시작: doc_id={document_id}")
        # 0. 기존 청크 삭제 (Clean Step)
        try:
            del_count = (
                self.db.query(DocumentChunk)
                .filter(DocumentChunk.document_id == document_id)
                .delete()
            )
            self.db.commit()
            print(f"🗑️ [Debug] 기존 청크 {del_count}개 삭제 완료")
        except Exception as e:
            print(f"❌ [Debug] 기존 청크 삭제 중 에러: {e}")

        # TODO: 토큰 계산을 위한 인코더 설정
        try:
            encoding = tiktoken.encoding_for_model(self.ai_model)
        except KeyError:
            encoding = tiktoken.get_encoding("cl100k_base")  # gpt-4로 가정하고 계산

        # DB에서 API Key 가져오기 (환경변수 의존 제거)
        from db.models.llm import LLMProvider

        api_key = None

        doc = self.db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            print("❌ [Debug] 문서를 찾을 수 없음")
            raise ValueError("문서를 찾을 수 없습니다.")

        user_id = doc.knowledge_base.user_id
        print(f"🔍 [Debug] 문서 소유자 ID: {user_id}")

        user_crd = (
            self.db.query(LLMCredential)
            .join(LLMProvider)
            .filter(
                LLMCredential.user_id == user_id,
                LLMCredential.is_valid,
                LLMProvider.name == "openai",
            )
            .first()
        )

        if user_crd:
            print(f"✅ [Debug] OpenAI 자격 증명 발견 (ID: {user_crd.id})")
            try:
                config = json.loads(user_crd.encrypted_config)
                api_key = config.get("apiKey")
            except Exception as e:
                print(f"[Debug] Credential config 파싱 실패: {e}")

        if not api_key:
            raise ValueError(
                "사용자의 OpenAI API Key를 찾을 수 없습니다. 등록해주세요."
            )
            print("⚠️ [Debug] OpenAI 자격 증명을 찾지 못함")
        print(f"✅ [Debug] API Key 확보 완료 (Key: {api_key[:8]}...)")

        # 임베딩 모델 초기화 (API Key 명시)
        embeddings_model = OpenAIEmbeddings(model=self.ai_model, openai_api_key=api_key)

        # 1. 텍스트 추출
        texts = [chunk["content"] for chunk in chunks]
        print(f"🔍 [Debug] 임베딩 요청 시작 (청크 개수: {len(texts)}개)")

        # 2. 임베딩 생성 (일괄 호출) - 실제 API 사용!
        try:
            embedded_vectors = embeddings_model.embed_documents(texts)
            print("✅ [Debug] 임베딩 생성 완료")
        except Exception as e:
            print(f"❌ [Debug] OpenAI Embedding Error: {e}")
            raise e

        # 3. DB 객체 생성
        try:
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

            print(
                f"📦 [Debug] 저장할 객체 {len(chunk_objects)}개 생성됨. DB에 추가(add) 시도..."
            )
            self.db.add_all(chunk_objects)
            print("💾 [Debug] 커밋(Commit) 시도...")
            self.db.commit()
            print("🎉 [Debug] DB 저장 및 커밋 성공!")

        except Exception as e:
            print(f"❌ [Debug] DB 저장 실패 (Commit Error): {e}")
            self.db.rollback()  # 롤백 시도
            raise e

    def _create_chunks(self, text_blocks: list[dict]) -> list[dict]:
        """
        텍스트 블록 리스트를 받아, 설정된 chunk_size와 chunk_overlap에 따라 청킹합니다.
        각 청크는 원본 텍스트 블록의 메타데이터를 유지하거나 병합할 수 있습니다.
        """
        chunks = []
        for block in text_blocks:
            text = block["text"]
            metadata = block.get("metadata", {})

            # 텍스트가 너무 짧으면 스킵할 수도 있음 (선택사항)
            if not text.strip():
                continue

            splits = self.text_splitter.split_text(text)

            for split in splits:
                chunks.append(
                    {
                        "content": split,
                        "metadata": metadata,  # 페이지 번호 등 원본 메타데이터 보존
                    }
                )

        return chunks

    def _finalize_ingestion(
        self, document_id: UUID, knowledge_base_id: UUID, text_blocks: list[dict]
    ):
        """
        텍스트 블록을 받아 청킹 -> 임베딩 -> 저장 -> 완료 처리를 수행합니다.
        """
        # 2단계: 청킹
        self._update_progress(
            document_id, 50, "AI가 읽기 좋게 문서를 조각내고 있습니다..."
        )
        chunks = self._create_chunks(text_blocks)

        # 3 & 4단계: 임베딩 및 저장
        self._update_progress(
            document_id, 70, "벡터 데이터베이스에 저장할 준비를 하고 있습니다..."
        )
        self._save_chunks_to_pgvector(document_id, knowledge_base_id, chunks)

        # 완료 상태 업데이트
        self._update_progress(document_id, 100, "모든 처리가 완료되었습니다.")
        self._update_status(document_id, "completed")

    def _update_status(self, document_id: UUID, status: str, error_message: str = None):
        doc = self.db.query(Document).get(document_id)
        if doc:
            doc.status = status
            if error_message:
                doc.error_message = error_message
            self.db.commit()

    def _update_progress(self, document_id: UUID, progress: int, message: str):
        """
        문서 처리 진행률(%)과 현재 단계 메시지를 meta_info에 업데이트합니다.
        """
        doc = self.db.query(Document).get(document_id)
        if doc:
            new_meta = dict(doc.meta_info or {})
            new_meta.update(
                {"processing_progress": progress, "processing_current_step": message}
            )
            doc.meta_info = new_meta
            self.db.commit()

    async def analyze_document(self, document_id: UUID) -> dict:
        """
        문서 분석: 페이지 수, 비용 예측 등을 반환
        """
        doc = self.db.query(Document).get(document_id)
        if not doc:
            raise ValueError("Document not found")

        # 1. 비용 예측 (FileDataSource 사용)
        try:
            # 임시로 FILE 타입 가정 (API 등은 0 반환)
            data_source = self._get_data_source(doc.source_type)
            source_config = {}
            if doc.source_type == SourceType.FILE:
                source_config = {"file_path": doc.file_path}

            cost_info = data_source.estimate_cost(source_config)
        except Exception as e:
            print(f"Cost estimation failed: {e}")
            cost_info = {"pages": 0, "credits": 0, "cost_usd": 0.0}

        # 2. 파일 타입 분석 (선택 사항)
        # parsing_strategy = self._analyze_pdf_type(doc.file_path)

        # 3. 캐시 확인 (파일인 경우에만)
        is_cached = False
        cache_path = ""

        if doc.source_type == SourceType.FILE and doc.file_path:
            cache_path = self._get_cache_path(doc.file_path)
            is_cached = os.path.exists(cache_path)

        print(
            f"🔍 [Debug] analyze_document: filename={doc.filename}, is_cached={is_cached}, path={cache_path}"
        )

        return {
            "cost_estimate": cost_info,
            "filename": doc.filename,
            "is_cached": is_cached,
            # "recommended_strategy": parsing_strategy
        }

    def _get_cache_path(self, file_path: str) -> str:
        """
        LlamaParse 결과 캐시 파일 경로를 반환합니다.
        (예: uploads/file.pdf -> uploads/file.pdf.md)
        """
        if not file_path:
            return ""
        return f"{file_path}.md"

    def preview_chunking(
        self,
        file_path: str,
        chunk_size: int,
        chunk_overlap: int,
        segment_identifier: str,
        remove_urls_emails: bool = False,
        remove_whitespace: bool = True,
        strategy: str = "general",  # "general" or "llamaparse",
        source_type: SourceType = SourceType.FILE,
        meta_info: dict = None,
    ) -> list[dict]:
        """
        DB 저장 없이 메모리 상에서 청킹 결과를 미리봅니다.
        strategy에 따라 일반 파싱 또는 정밀 파싱(LlamaParse)을 수행합니다.
        """
        # 1. 텍스트 추출
        try:
            if source_type == SourceType.API:
                # API 반환값 처리, 헤더 복호화
                api_config = meta_info.get("api_config", {})
                headers = api_config.get("headers")
                if headers and isinstance(headers, str):
                    try:
                        from core.security import security_service

                        decrypted_json = security_service.decrypt(headers)
                        api_config["headers"] = json.loads(decrypted_json)
                    except Exception as e:
                        print(f"Failed to decrypt headers: {e}")
                        api_config["headers"] = {}

                data_source = ApiDataSource()
                source_config = api_config
            else:
                data_source = FileDataSource()
                source_config = {
                    "file_path": file_path,
                    "strategy": strategy,  # "general" or "llamaparse"
                }

            text_blocks = data_source.fetch_text(source_config)
            full_text = "\n".join([block["text"] for block in text_blocks])
        except Exception as e:
            print(f"Preview parsing failed: {e}")
            return []

        # 2. 전처리
        if remove_urls_emails:
            # URL 제거
            full_text = re.sub(
                r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
                "",
                full_text,
            )
            # 이메일 제거
            full_text = re.sub(r"[\w\.-]+@[\w\.-]+", "", full_text)

        if remove_whitespace:
            # 연속된 공백, 탭을 단일 공백으로 치환
            full_text = re.sub(r"[ \t]+", " ", full_text)
            # 연속된 줄바꿈이 3개 이상이면 2개(\n\n)로 축소 (문단 구분 유지)
            full_text = re.sub(r"\n{3,}", "\n\n", full_text)

        # 3. 청킹 설정 오버라이드
        # segment_identifier가 유효하면 separator 목록의 최우선 순위로 추가
        separators = ["\n\n", "\n", ".", " ", ""]
        if segment_identifier and segment_identifier not in separators:
            # 특수 문자(escaped) 처리 필요할 수 있음. 일단 있는 그대로 사용.
            # 사용자가 "\n\n"을 입력하면 문자열 그대로 들어오므로, 실제 이스케이프 시퀀스로 변환해주는 로직이 필요할 수 있음.
            # 프론트에서 실제 줄바꿈을 보내거나, 여기서 변환해야 함.
            # 일단은 단순 문자열 매칭으로 가정하되, \n은 특별 취급
            processed_identifier = segment_identifier.replace("\\n", "\n")
            if processed_identifier not in separators:
                separators.insert(0, processed_identifier)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=separators,
            keep_separator=True,
        )

        splits = splitter.split_text(full_text)

        # 4. 결과 포맷팅 & 토큰 계산
        try:
            encoding = tiktoken.encoding_for_model(self.ai_model)
        except KeyError:
            encoding = tiktoken.get_encoding("cl100k_base")

        preview_segments = []
        for split in splits:
            token_count = len(encoding.encode(split))
            preview_segments.append(
                {
                    "content": split,
                    "token_count": token_count,
                    "char_count": len(split),
                }
            )

        return preview_segments
