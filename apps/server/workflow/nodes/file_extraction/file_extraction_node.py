import os
import tempfile
from typing import Any, Dict

import pymupdf4llm
import requests

from ..base.node import Node
from .entities import FileExtractionNodeData


class FileExtractionNode(Node[FileExtractionNodeData]):
    """
    PDF 파일에서 텍스트를 추출하는 노드

    기능:
    - PDF 파일 경로를 받아서 텍스트 추출
    - pymupdf4llm을 사용하여 마크다운 형식으로 변환
    - 페이지별 메타데이터 포함
    """

    node_type = "fileExtractionNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        PDF 파일에서 텍스트를 추출합니다.

        Args:
            inputs: 이전 노드 결과 (변수 풀)

        Returns:
            추출된 텍스트와 메타데이터
            {
                "result": "전체 텍스트...",
                "page_count": 5
            }
        """

        # STEP 1. 필수값 검증
        if not self.data.file_path_variable or len(self.data.file_path_variable) < 1:
            raise ValueError("파일 경로 변수를 선택해주세요.")

        # STEP 2. 파일 경로 추출
        file_path = self._extract_file_path(inputs)

        # STEP 3. 파일 준비 (S3 URL이면 다운로드)
        is_remote = file_path.startswith("http")
        temp_file_path = None

        try:
            if is_remote:
                # S3/HTTP URL에서 파일 다운로드
                temp_file_path = self._download_file(file_path)
                target_path = temp_file_path
            else:
                # 로컬 파일 확인
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
                target_path = file_path

            # STEP 4. PDF 텍스트 추출
            try:
                md_text_chunks = pymupdf4llm.to_markdown(target_path, page_chunks=True)
            except Exception as e:
                raise ValueError(f"PDF 파싱 실패: {str(e)}")

            # STEP 5. 전체 텍스트 합치기
            full_text = "\n\n".join([chunk["text"] for chunk in md_text_chunks])

            # STEP 6. 결과 반환
            return {"result": full_text, "page_count": len(md_text_chunks)}

        finally:
            # 임시 파일 정리
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception as e:
                    print(f"[Warning] Failed to remove temp file: {e}")

    def _extract_file_path(self, inputs: Dict[str, Any]) -> str:
        """
        value_selector를 사용하여 파일 경로를 추출합니다.

        LLMNode의 변수 추출 로직과 동일한 방식
        """
        selector = self.data.file_path_variable

        if not selector or len(selector) < 1:
            return None

        # 첫 번째 요소: 노드 ID
        target_node_id = selector[0]
        source_data = inputs.get(target_node_id)

        if source_data is None:
            return None

        # 두 번째 요소가 있으면: 특정 키 추출
        if len(selector) > 1:
            if isinstance(source_data, dict):
                return source_data.get(selector[1])
            else:
                return None
        else:
            # 노드 ID만 있으면 전체 데이터 반환
            return source_data

    def _download_file(self, url: str) -> str:
        """
        S3/HTTP URL에서 파일을 다운로드하여 임시 경로를 반환합니다.
        """
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()

            # 확장자 추론
            from urllib.parse import urlparse

            path = urlparse(url).path
            ext = os.path.splitext(path)[1]
            if not ext:
                ext = ".pdf"

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                for chunk in response.iter_content(chunk_size=8192):
                    tmp.write(chunk)
                return tmp.name
        except Exception as e:
            raise RuntimeError(f"Failed to download file from {url}: {e}")
