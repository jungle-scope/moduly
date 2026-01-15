import os
import pathlib
import sys

# 프로젝트 루트를 sys.path에 추가
ROOT = (
    pathlib.Path(__file__).resolve().parents[4]
)  # apps/shared/tests/manual -> 4단계 상위
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from unittest.mock import MagicMock

from apps.gateway.services.ingestion_local_service import IngestionService
from dotenv import load_dotenv

# .env 로드 (API Key 필요)
load_dotenv(ROOT / ".env")


def test_pdf_parsing(file_path):
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found at {file_path}")
        return

    print(f"🚀 Parsing file: {file_path}...")

    # 결과 파일 경로 생성
    output_path = f"{file_path}_parsed.md"

    service = IngestionService(db=MagicMock())

    try:
        # pylint: disable=protected-access
        results = service._parse_pdf(file_path)

        print(f"✅ Parsing Complete! Found {len(results)} pages/blocks.")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(f"# PDF Parsing Result: {os.path.basename(file_path)}\n")
            f.write(f"Total Pages: {len(results)}\n\n")
            f.write("---\n\n")

            for item in results:
                content = item["text"]
                page_num = item["page"]
                f.write(f"## Page {page_num}\n\n{content}\n\n---\n\n")

        print(f"📄 Result saved to: {output_path}")

    except Exception as e:
        print(f"❌ Parsing Failed: {e}")
        import traceback

        traceback.print_exc()


def test_llamaparse_direct(file_path):
    """LlamaParse 직접 호출 테스트"""
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found at {file_path}")
        return

    print(f"🚀 [DIRECT TEST] Calling LlamaParse for: {file_path}...")
    service = IngestionService(db=MagicMock())

    try:
        results = service._parse_with_llamaparse(file_path)
        print(f"✅ LlamaParse Complete! Found {len(results)} pages.")
        for item in results:
            print(f"[Page {item['page']}] Length: {len(item['text'])}")
            print(item["text"][:200] + "...")
            print("-" * 20)
    except Exception as e:
        print(f"❌ LlamaParse Failed: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_pdf_parser.py <path_to_pdf_file> [--llama]")
    else:
        file_path = sys.argv[1]
        if len(sys.argv) > 2 and sys.argv[2] == "--llama":
            test_llamaparse_direct(file_path)
        else:
            test_pdf_parsing(file_path)
