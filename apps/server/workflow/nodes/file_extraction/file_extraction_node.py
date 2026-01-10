import os
from typing import Any, Dict, Optional

import pymupdf4llm

from ..base.node import Node
from .entities import FileExtractionNodeData


class FileExtractionNode(Node[FileExtractionNodeData]):
    """
    문서 파일에서 텍스트를 추출하는 노드

    기능:
    - PDF 파일 경로를 받아서 텍스트 추출
    - pymupdf4llm을 사용하여 마크다운 형식으로 변환
    - 페이지별 메타데이터 포함
    - 여러 변수 중 첫 번째 유효한 파일 경로 사용
    - 사용자가 정의한 이름으로 출력 변수 생성
    """

    node_type = "fileExtractionNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        문서 파일에서 텍스트를 추출합니다.

        Args:
            inputs: 이전 노드 결과 (변수 풀)

        Returns:
            사용자가 정의한 변수명으로 추출된 텍스트
            {
                "user_var1": "전체 텍스트...",
                "user_var2": "전체 텍스트..."
            }
        """

        # STEP 1. 필수값 검증
        if not self.data.referenced_variables:
            raise ValueError("파일 경로 변수를 선택해주세요.")

        # STEP 2. 각 변수에 대해 파일 추출 수행
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

            # 파일 존재 확인
            if not file_path:
                raise ValueError(f"파일 경로를 찾을 수 없습니다: {output_name}")

            if not os.path.exists(file_path):
                raise FileNotFoundError(
                    f"파일을 찾을 수 없습니다: {file_path} (변수: {output_name})"
                )

            # 문서 텍스트 추출
            try:
                md_text_chunks = pymupdf4llm.to_markdown(file_path, page_chunks=True)
            except Exception as e:
                raise ValueError(
                    f"문서 파싱 실패: {str(e)} (변수: {output_name}, 파일: {file_path})"
                )

            # 전체 텍스트 합치기
            full_text = "\n\n".join([chunk["text"] for chunk in md_text_chunks])

            # 사용자 정의 이름으로 결과 저장
            results[output_name] = full_text

        # STEP 3. 결과 반환
        return results

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
