import logging
import os
import tempfile
import concurrent.futures
from typing import Any, Dict, Optional

import pymupdf4llm
import requests

from ..base.node import Node
from .entities import FileExtractionNodeData

# CPU 바운드 작업을 위한 전용 Executor (모듈 레벨 공유)
# max_workers는 서버 사양에 맞게 조절 (예: CPU 코어 수 * 2 등)
_cpu_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

logger = logging.getLogger(__name__)


class FileExtractionNode(Node[FileExtractionNodeData]):
    """
    문서 파일에서 텍스트를 추출하는 노드

    기능:
    - PDF 파일 경로를 받아서 텍스트 추출
    - S3 URL 또는 로컬 파일 경로 지원
    - pymupdf4llm을 사용하여 마크다운 형식으로 변환
    - 여러 변수 처리 및 중복 체크
    - 사용자가 정의한 이름으로 출력 변수 생성
    """

    node_type = "fileExtractionNode"

    async def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        문서 파일에서 텍스트를 추출합니다 (비동기).
        I/O 작업(다운로드)와 CPU 작업(PDF 변환)을 분리하여 처리합니다.
        CPU 바운드 작업은 전용 Executor를 사용하여 이벤트 루프 블로킹을 방지합니다.

        Args:
            inputs: 이전 노드 결과 (변수 풀)

        Returns:
            사용자가 정의한 변수명으로 추출된 텍스트
            {
                "user_var1": "전체 텍스트...",
                "user_var2": "전체 텍스트..."
            }
        """
        import asyncio

        loop = asyncio.get_running_loop()

        if not self.data.referenced_variables:
            raise ValueError("파일 경로 변수를 선택해주세요.")

        # 각 변수에 대해 파일 추출 수행
        results = {}
        seen_names = set()  # 중복 체크용

        for variable in self.data.referenced_variables:
            # 출력 변수명 확인
            if not variable.name or not variable.name.strip():
                raise ValueError("출력 변수명을 입력해주세요.")

            output_name = variable.name.strip()

            # 중복 체크
            if output_name in seen_names:
                raise ValueError(f"중복된 변수명입니다: {output_name}")
            seen_names.add(output_name)

            # 파일 경로 추출
            file_path = self._extract_value_from_selector(
                variable.value_selector, inputs
            )

            # 파일 경로 확인
            if not file_path:
                raise ValueError(f"파일 경로를 찾을 수 없습니다: {output_name}")

            # 파일 준비 (S3 URL이면 다운로드, 로컬이면 경로 확인)
            is_remote = file_path.startswith("http")
            temp_file_path = None
            target_path = None

            try:
                if is_remote:
                    # S3/HTTP URL에서 파일 다운로드 (I/O Bound -> Default Executor)
                    temp_file_path = await loop.run_in_executor(
                        None, self._download_file, file_path
                    )
                    target_path = temp_file_path
                else:
                    # 로컬 파일 확인
                    if not os.path.exists(file_path):
                        raise FileNotFoundError(
                            f"파일을 찾을 수 없습니다: {file_path} (변수: {output_name})"
                        )
                    target_path = file_path

                # 문서 텍스트 추출 (CPU Bound -> Dedicated Executor)
                # pymupdf4llm은 CPU를 많이 사용하므로 별도 스레드 풀에서 실행
                full_text = await loop.run_in_executor(
                    _cpu_executor,
                    self._extract_text_sync,
                    target_path,
                    output_name,
                    file_path,
                )
                results[output_name] = full_text

            finally:
                # 임시 파일 정리
                if temp_file_path and os.path.exists(temp_file_path):
                    try:
                        os.remove(temp_file_path)
                    except Exception as e:
                        print(f"[Warning] Failed to remove temp file: {e}")

        return results

    def _extract_text_sync(
        self, target_path: str, output_name: str, original_path: str
    ) -> str:
        """
        실제 PDF 파싱을 수행하는 동기 함수 (CPU Bound).
        별도의 Executor에서 실행되어야 합니다.
        """
        try:
            md_text_chunks = pymupdf4llm.to_markdown(target_path, page_chunks=True)
            return "\n\n".join([chunk["text"] for chunk in md_text_chunks])
        except Exception as e:
            raise ValueError(
                f"문서 파싱 실패: {str(e)} (변수: {output_name}, 파일: {original_path})"
            )

    def _extract_value_from_selector(
        self, selector: list[str], inputs: Dict[str, Any]
    ) -> Optional[str]:
        """
        value_selector를 사용하여 값을 추출합니다.

        Args:
            selector: [node_id, output_key] 형식의 선택자
            inputs: 이전 노드 결과 (변수 풀)

        Returns:
            추출된 값, 없으면 None
        """
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

        Args:
            url: 다운로드할 파일의 URL

        Returns:
            임시 파일 경로
        """
        try:
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()

            # 확장자 추론
            from urllib.parse import urlparse

            path = urlparse(url).path
            ext = os.path.splitext(path)[1]
            if not ext:
                ext = ".pdf"

            # 임시 파일 생성 및 다운로드
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:  # 빈 chunk 필터링
                        tmp.write(chunk)
                return tmp.name

        except requests.RequestException as e:
            raise RuntimeError(f"파일 다운로드 실패: {url} - {str(e)}")
        except Exception as e:
            raise RuntimeError(f"파일 처리 중 오류: {str(e)}")
