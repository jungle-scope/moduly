import os  # 폴더 만들기용
import shutil  # 파일 복사용
from enum import Enum
from uuid import UUID

import fitz
import pymupdf4llm
import tiktoken
from fastapi import UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk


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
        파싱 -> 청킹 -> 임베딩 -> 저장
        """
        try:
            self._update_status(document_id, "indexing")

            # 1단계: 파싱 (document_id 전달)
            text_blocks = self._parse_pdf(file_path, document_id)

            # 파싱 결과가 비어있다면 (비용 승인 대기 등) 중단
            if not text_blocks:
                doc = self.db.query(Document).get(document_id)
                if doc and doc.status == "waiting_for_approval":
                    print(f"⏸️ Document {document_id} paused for approval.")
                    return
                # 진짜 내용이 없는 경우일 수도 있음 (이 경우 completed 처리됨)

            # 2단계: 청킹
            chunks = self._create_chunks(text_blocks)

            # 3 & 4단계: 임베딩 및 저장
            self._save_chunks_to_pgvector(document_id, knowledge_base_id, chunks)

            self._update_status(document_id, "completed")
        except Exception as e:
            print(f"Ingestion failed: {e}")
            self._update_status(document_id, "failed", error_message=str(e))

    async def resume_with_llamaparse(self, document_id: UUID):
        """
        승인된 문서에 대해 LlamaParse로 파싱을 재개하고 나머지 파이프라인 수행
        """
        doc = self.db.query(Document).get(document_id)
        if not doc:
            print(f"❌ Document {document_id} not found for resumption.")
            return

        try:
            print(f"▶️ Resuming ingestion for {document_id} with LlamaParse...")
            self._update_status(document_id, "indexing")

            # 1단계: LlamaParse 강제 실행
            text_blocks = self._parse_with_llamaparse(doc.file_path)

            # 2단계: 청킹
            chunks = self._create_chunks(text_blocks)

            # 3 & 4단계: 임베딩 및 저장
            self._save_chunks_to_pgvector(document_id, doc.knowledge_base_id, chunks)

            self._update_status(document_id, "completed")

        except Exception as e:
            print(f"❌ Resumption failed: {e}")
            self._update_status(document_id, "failed", error_message=str(e))

    def _analyze_pdf_type(self, file_path: str) -> str:
        """
        PDF 파일의 성격을 파악하여 적절한 파싱 전략을 반환합니다.

        Sampling Strategy:
        - 앞 3페이지 + 중간 1페이지 + 뒤 2페이지 (총 최대 6페이지)

        Returns:
            - 'special': 전체가 이미지거나 텍스트가 거의 없는 경우 (LlamaParse 등 필요) -> OCR 필요
            - 'fast': 텍스트 위주의 일반적인 문서 (PyMuPDF4LLM 사용)
            - 'precise': 텍스트와 이미지가 섞여있어 정밀한 레이아웃 분석이 필요한 경우
        """
        doc = fitz.open(file_path)
        total_pages = len(doc)

        # 1. 너무 큰 파일 예외 처리 (예: 500페이지 이상은 일단 경고)
        if total_pages > 500:
            print(f"[Warn] Large file detected: {total_pages} pages.")

        # 2. 샘플링 페이지 인덱스 선정
        sample_indices = set()

        # 앞 3페이지
        for i in range(min(3, total_pages)):
            sample_indices.add(i)

        # 중간 1페이지
        if total_pages > 3:
            sample_indices.add(total_pages // 2)

        # 뒤 2페이지
        if total_pages > 1:
            sample_indices.add(total_pages - 1)
        if total_pages > 2:
            sample_indices.add(total_pages - 2)

        sorted_indices = sorted(list(sample_indices))

        # 3. 샘플링 분석
        image_count = 0
        text_length = 0
        page_count = 0

        for idx in sorted_indices:
            if idx >= total_pages:
                continue

            page = doc[idx]
            page_count += 1

            # 텍스트 추출
            text = page.get_text()
            text_length += len(text.strip())

            # 이미지 객체 카운트
            images = page.get_images(full=True)
            image_count += len(images)

        doc.close()

        # 4. 분석 결과에 따른 전략 결정

        # 평균 텍스트 길이 (페이지당)
        avg_text_per_page = text_length / page_count if page_count > 0 else 0

        # 평균 이미지 수 (페이지당)
        avg_images_per_page = image_count / page_count if page_count > 0 else 0

        print(
            f"[PDF Analysis] Avg Text: {avg_text_per_page:.1f}, Avg Images: {avg_images_per_page:.1f}"
        )

        # Case A: 텍스트가 거의 없음 (OCR 필요)
        if avg_text_per_page < 50:
            return ParsingStrategy.IMAGE

        # Case B: 이미지가 많고 텍스트도 어느정도 있음 (복잡한 레이아웃 가능성)
        elif avg_images_per_page > 2:
            return ParsingStrategy.MIXED

        # Case C: 텍스트 위주
        else:
            return ParsingStrategy.TEXT

    def _parse_with_pymupdf(self, file_path: str) -> list[dict]:
        """기존 PyMuPDF4LLM 기반 파싱 로직"""
        md_text_chunks = pymupdf4llm.to_markdown(file_path, page_chunks=True)

        results = []
        for chunk in md_text_chunks:
            results.append(
                {
                    "text": chunk["text"],
                    "page": chunk["metadata"]["page"] + 1,
                }
            )
        return results

    def _parse_with_llamaparse(self, file_path: str) -> list[dict]:
        """LlamaParse API 연동"""

        # 비용 예측 로그 출력
        est = self._estimate_llamaparse_cost(file_path)
        print(
            f"💰 [비용 예측] 페이지 수: {est['pages']}, 크레딧: {est['credits']}, 비용: ${est['cost_usd']:.4f}"
        )

        try:
            from llama_parse import LlamaParse
        except ImportError:
            print(
                "❌ LlamaParse 라이브러리를 찾을 수 없습니다. 'pip install llama-parse'를 실행해주세요."
            )
            return []

        api_key = os.getenv("LLAMA_CLOUD_API_KEY")
        if not api_key:
            print("❌ LLAMA_CLOUD_API_KEY 환경변수가 설정되지 않았습니다.")
            return []

        print("🚀 LlamaParse 클라우드 처리 시작...")

        try:
            # 파서 초기화
            # result_type="markdown"이 기본값이지만 명시적으로 설정
            # language="ko"를 설정하여 한국어 인식률 향상
            parser = LlamaParse(
                api_key=api_key,
                result_type="markdown",
                verbose=True,
                language="ko",
                fast_mode=True,
            )

            # JSON 결과를 받아야 페이지별 텍스트와 메타데이터를 확실하게 구분할 수 있음
            # get_json_result는 파일당 하나의 결과 객체를 리스트로 반환함
            json_results = parser.get_json_result(file_path)

            # [Debug] 구조 확인
            # print(f"🔍 [LlamaParse Raw Result]: {json_results}")

            parsed_results = []
            full_text_for_debug = ""

            if json_results and isinstance(json_results, list):
                first_result = json_results[0]
                # 'pages' 키에 각 페이지별 파싱 결과가 담겨있음
                pages = first_result.get("pages", [])

                for p in pages:
                    # 'md' 키가 없을 경우를 대비해 키 확인
                    # 'md' 키가 없으면 'text' 키를 사용 (fast_mode 등에서 발생)
                    md_text = p.get("md") or p.get("text") or ""
                    parsed_results.append(
                        {
                            "text": md_text,  # 마크다운 변환 텍스트
                            "page": p["page"],  # 페이지 번호
                        }
                    )
                    full_text_for_debug += f"\n--- Page {p['page']} ---\n{md_text}\n"

            # [Debug] 파싱된 결과를 파일로 저장
            # try:
            #     base_dir = os.path.dirname(file_path)
            #     file_name = os.path.basename(file_path)
            #     debug_file_name = f"{os.path.splitext(file_name)[0]}_parsed.md"
            #     debug_file_path = os.path.join(base_dir, debug_file_name)

            #     with open(debug_file_path, "w", encoding="utf-8") as f:
            #         f.write(full_text_for_debug)
            #     print(f"💾 [Debug] Parsed content saved to: {debug_file_path}")
            # except Exception as e:
            #     print(f"⚠️ Failed to save debug file: {e}")

            print(f"LlamaParse 완료: 총 {len(parsed_results)} 페이지 변환됨.")
            return parsed_results

        except Exception as e:
            print(f"LlamaParse 처리 실패: {e}")
            return []

    def _estimate_llamaparse_cost(self, file_path: str) -> dict:
        """
        LlamaParse 예측 비용 계산
        기준: Standard Mode (3 credits/page), $1 = 1000 credits
        """
        try:
            doc = fitz.open(file_path)
            total_pages = len(doc)
            doc.close()

            # Standard Mode 기준 (페이지당 3 크레딧)
            credits_per_page = 3
            total_credits = total_pages * credits_per_page
            cost_usd = total_credits / 1000.0

            return {
                "pages": total_pages,
                "credits": total_credits,
                "cost_usd": cost_usd,
            }
        except Exception as e:
            print(f"[Warning] Cost estimation failed: {e}")
            return {"pages": 0, "credits": 0, "cost_usd": 0.0}

    def _is_mixed_quality_poor(self, results: list[dict]) -> bool:
        """MIXED 모드 품질 검사: 레이아웃이 심각하게 깨졌는지 확인"""
        total_text = "".join([r["text"] for r in results])

        # 휴리스틱 1: 알 수 없는 특수문자나 공백 패턴이 너무 많은 경우
        if len(total_text) > 0:
            broken_char_count = total_text.count("\ufffd")
            if (broken_char_count / len(total_text)) > 0.05:  # 5% 이상 깨짐
                print("Reason: High broken character rate in MIXED mode.")
                return True

        # 휴리스틱 2: 마크다운 구조가 거의 없음 (헤더 #이 너무 적음)
        # 일반적인 문서라면 페이지당 적어도 1~2개의 헤더는 있어야 함
        page_count = len(results)
        header_count = total_text.count("\n#")
        if (
            page_count > 0 and (header_count / page_count) < 0.2
        ):  # 5페이지당 헤더 1개 미만
            print("Reason: Too few markdown headers found.")
            return True

        return False

    def _is_text_quality_poor(self, file_path: str, results: list[dict]) -> bool:
        """TEXT 모드 품질 검사"""
        total_text = "".join([r["text"] for r in results])

        # 1. 글자 수가 너무 적음 (50자 미만)
        if len(total_text.strip()) < 50:
            print("Reason: Too few characters extracted.")
            return True

        # 2. 깨진 문자(replacement character ) 비율 확인
        broken_char_count = total_text.count("\ufffd")  # or other garbage chars
        if len(total_text) > 0 and (
            broken_char_count / len(total_text) > 0.05
        ):  # 5% 이상
            print("Reason: Too many broken characters.")
            return True

        # 3. (고급) PyMuPDF로 표(Table)는 감지되는데, 추출된 텍스트에는 마크다운 표 문법(|---|)이 없는 경우
        try:
            doc = fitz.open(file_path)
            has_table_but_no_markdown = False

            # 성능을 위해 앞부분 5페이지만 검사
            for i in range(min(5, len(doc))):
                page = doc[i]
                tables = page.find_tables()
                if tables and len(tables.tables) > 0:
                    # 해당 페이지의 추출된 텍스트 찾기
                    page_text = results[i]["text"] if i < len(results) else ""
                    # 표는 있는데 마크다운 표 구문('|')이 전혀 없다면 파싱 실패로 간주
                    if "|" not in page_text:
                        print(
                            f"Reason: Table detected on page {i + 1} but no markdown table found."
                        )
                        has_table_but_no_markdown = True
                        break

            doc.close()
            if has_table_but_no_markdown:
                return True

        except Exception as e:
            print(f"[Warning] Table check failed: {e}")
            # 에러 나면 안전하게 False 반환 (Flow 중단 안 함)
            return False

        return False

    def _request_llamaparse_approval(
        self, file_path: str, document_id: UUID
    ) -> list[dict]:
        """
        LlamaParse 호출 전 비용 계산 후 '승인 대기' 상태로 변경하고 중단함.
        """
        if not document_id:
            # document_id가 없으면(디버그/테스트 모드) 그냥 진행
            print("No document_id provided. Skipping approval and running LlamaParse.")
            return self._parse_with_llamaparse(file_path)

        # 1. 비용 계산
        est = self._estimate_llamaparse_cost(file_path)

        # 2. DB 업데이트 (상태: waiting_for_approval)
        doc = self.db.query(Document).get(document_id)
        if doc:
            doc.status = "waiting_for_approval"
            # 기존 메타데이터에 비용 정보 병합
            new_meta = dict(doc.meta_info or {})
            new_meta.update({"cost_estimate": est, "strategy": "llamaparse_fallback"})
            doc.meta_info = new_meta
            self.db.commit()

        print(
            f"⏸️ [Approval Required] Document {document_id} paused for LlamaParse cost approval."
        )

        # 3. 빈 리스트 반환하여 파이프라인 중단
        return []

    def _parse_pdf(self, file_path: str, document_id: UUID = None) -> list[dict]:
        """
        PDF 파싱 메인 진입점.
        적절한 파서(PyMuPDF / LlamaParse)를 선택하고,
        품질 저하 시 Fallback 로직을 수행 (비용 승인 프로세스 포함)
        """
        # 1. 파일 성격 파악
        parsing_strategy = self._analyze_pdf_type(file_path)
        print(f"[{file_path}] Parsing Strategy: {parsing_strategy.value}")

        # Case 1: 이미지 위주 (OCR 필수) -> 승인 요청
        if parsing_strategy == ParsingStrategy.IMAGE:
            print("Strategy is IMAGE. Requesting approval for LlamaParse.")
            return self._request_llamaparse_approval(file_path, document_id)

        # Case 2: 혼합형 (텍스트 + 이미지)
        elif parsing_strategy == ParsingStrategy.MIXED:
            # 1차 시도: PyMuPDF (빠름)
            results = self._parse_with_pymupdf(file_path)

            # 품질 검사: 결과물이 '난잡'한지 확인
            if self._is_mixed_quality_poor(results):
                print(
                    "Mixed parsing quality is poor. Requesting approval for LlamaParse."
                )
                return self._request_llamaparse_approval(file_path, document_id)

            return results

        # Case 3: 텍스트 위주
        else:  # ParsingStrategy.TEXT
            # 1차 시도: PyMuPDF
            results = self._parse_with_pymupdf(file_path)

            # 품질 검사: 텍스트 누락, 깨짐, 표 구조 이상 확인
            if self._is_text_quality_poor(file_path, results):
                print(
                    "Text parsing quality is poor. Requesting approval for LlamaParse."
                )
                return self._request_llamaparse_approval(file_path, document_id)

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
