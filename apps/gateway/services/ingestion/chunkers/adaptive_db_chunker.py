"""
AdaptiveDbChunker: 길이 기반 조건부 청킹

DB 데이터의 Jinja2 렌더링 결과를 길이에 따라 조건부로 청킹합니다.
- 1,000자 이하: 단일 청크 유지
- 1,000자 초과: RecursiveSplitter로 분할 (150자 Overlap)
"""

from typing import Any, Dict, List, Optional

import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter


class AdaptiveDbChunker:
    """
    DB 데이터의 Jinja2 렌더링 결과를 길이 기반으로 조건부 청킹

    - 1,000자 이하: 단일 청크 유지
    - 1,000자 초과: RecursiveSplitter로 분할 + Overlap으로 문맥 보존
    """

    # 청킹 임계값
    CHAR_THRESHOLD = 1000
    TOKEN_THRESHOLD = 800

    # 안전 제한 (임베딩 모델 한계의 ~60%)
    MAX_CHAR_LIMIT = 6000
    MAX_TOKEN_LIMIT = 5000

    # 청킹 설정 (Golden Ratio)
    CHUNK_SIZE = 1000
    OVERLAP = 150  # 15%

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ".", " ", ""],
            keep_separator=True,
        )
        try:
            self.tokenizer = tiktoken.encoding_for_model("gpt-3.5-turbo")
        except Exception:
            self.tokenizer = tiktoken.get_encoding("cl100k_base")

    def chunk_if_needed(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
        enable_chunking: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        조건부 청킹 실행 (비상 청킹 포함)

        Args:
            text: Jinja2 렌더링 결과 (이미 자연어 문장)
            metadata: 원본 메타데이터
            enable_chunking: 자동 청킹 활성화 여부 (UI 설정)

        Returns:
            List[{"content": str, "metadata": dict}]
        """
        import logging

        logger = logging.getLogger(__name__)

        # 1. 길이 측정
        char_count = len(text)
        token_count = len(self.tokenizer.encode(text))

        # 2. 비상 청킹 임계값 (임베딩 모델 한계)
        EMERGENCY_THRESHOLD = 8000  # text-embedding-3-small 한계의 ~98%

        # 3. 비상 청킹 검증 (사용자 설정 무시)
        if token_count > EMERGENCY_THRESHOLD:
            logger.warning(
                f"🚨 Emergency Chunking 활성화: {token_count} tokens > {EMERGENCY_THRESHOLD} limit. "
                f"임베딩 모델 한계로 인해 강제 분할합니다."
            )

            # 비상 청킹 설정 (큰 덩어리 유지)
            emergency_splitter = RecursiveCharacterTextSplitter(
                chunk_size=4000,  # 4,000 토큰 (약 16,000 chars)
                chunk_overlap=400,  # 400 토큰 (10%)
                length_function=lambda txt: len(self.tokenizer.encode(txt)),
                separators=["\n\n", "\n", ".", " ", ""],
                keep_separator=True,
            )

            raw_chunks = emergency_splitter.split_text(text)

            result_chunks = []
            for idx, chunk_content in enumerate(raw_chunks):
                chunk_tokens = len(self.tokenizer.encode(chunk_content))

                result_chunks.append(
                    {
                        "content": chunk_content,
                        "metadata": {
                            **(metadata or {}),
                            "char_count": len(chunk_content),
                            "token_count": chunk_tokens,
                            "chunked": True,
                            "emergency_chunked": True,
                            "chunk_index": idx,
                            "total_chunks": len(raw_chunks),
                        },
                    }
                )

            logger.info(f"✅ Emergency Chunking 완료: {len(raw_chunks)} chunks 생성")
            return result_chunks

        # 4. 일반 청킹 필요 여부 판단
        should_chunk = enable_chunking and (
            char_count > self.CHAR_THRESHOLD or token_count > self.TOKEN_THRESHOLD
        )

        if not should_chunk:
            # 단일 청크 반환
            return [
                {
                    "content": text,
                    "metadata": {
                        **(metadata or {}),
                        "char_count": char_count,
                        "token_count": token_count,
                        "chunked": False,
                    },
                }
            ]

        # 5. RecursiveSplitter로 분할 (Overlap으로 문맥 보존)
        raw_chunks = self.text_splitter.split_text(text)

        # 6. 메타데이터와 함께 반환
        result_chunks = []
        for idx, chunk_content in enumerate(raw_chunks):
            chunk_tokens = len(self.tokenizer.encode(chunk_content))

            result_chunks.append(
                {
                    "content": chunk_content,
                    "metadata": {
                        **(metadata or {}),
                        "char_count": len(chunk_content),
                        "token_count": chunk_tokens,
                        "chunked": True,
                        "chunk_index": idx,
                        "total_chunks": len(raw_chunks),
                    },
                }
            )

        return result_chunks
