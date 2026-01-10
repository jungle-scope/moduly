import json
import os
import sys

# 현재 스크립트의 위치를 기준으로 apps/server 경로를 sys.path에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.abspath(os.path.join(current_dir, "../../../apps/server"))
sys.path.append(server_dir)

# 환경 변수 설정 (테스트용 키가 없으면 .env에서 로드하거나 더미 키 사용)
if not os.getenv("MASTER_KEY"):
    # .env 파일 로드 시도
    from dotenv import load_dotenv

    load_dotenv(os.path.join(server_dir, ".env"))

# 그래도 없으면 테스트용 키 설정 (이전에 생성한 키 사용)
if not os.getenv("MASTER_KEY"):
    os.environ["MASTER_KEY"] = "YYVNBn+8Q3o2GEzefWVUp42wjJaj5T4GpKLqhgRRSZ0="

from core.security import security_service
from shared.db.models.knowledge import Document


def test_encryption_flow():
    print("=== API 헤더 암호화/복호화 검증 테스트 ===\n")

    # 1. 원본 데이터 준비 (사용자가 입력한 민감한 헤더)
    original_headers_dict = {"Authorization": "Bearer sk-secret-token-12345"}
    original_headers_str = json.dumps(original_headers_dict)
    print(f"1. [Input] 원본 헤더 (사용자 입력): {original_headers_str}")

    # 2. 암호화 시뮬레이션 (rag.py 저장 로직)
    print("\n2. [Process] DB 저장 전 암호화 수행중...")
    encrypted_headers = security_service.encrypt(original_headers_str)

    print(f"   => 암호화된 결과 (DB 저장값): {encrypted_headers}")

    # 검증: 평문과 암호문이 달라야 함
    assert original_headers_str != encrypted_headers
    assert "Bearer" not in encrypted_headers
    print("   ✅ 확인: 데이터가 안전하게 암호화되었습니다.")

    # 3. DB 저장 상태 시뮬레이션 (Document 객체)
    doc = Document(meta_info={"api_config": {"headers": encrypted_headers}})
    print(f"\n3. [Storage] DB 객체 상태 (meta_info): {doc.meta_info}")

    # 4. 복호화 시뮬레이션 (ingestion_local_service.py 사용 로직)
    print("\n4. [Usage] API 호출을 위한 복호화 수행중...")

    stored_headers = doc.meta_info["api_config"]["headers"]
    decrypted_headers_str = ""

    if stored_headers and isinstance(stored_headers, str):
        decrypted_headers_str = security_service.decrypt(stored_headers)
        print(f"   => 복호화된 결과: {decrypted_headers_str}")

    # 검증: 복호화된 결과가 원본과 일치해야 함
    assert decrypted_headers_str == original_headers_str
    print("   ✅ 확인: 복호화된 데이터가 원본과 정확히 일치합니다.")


if __name__ == "__main__":
    try:
        test_encryption_flow()
        print("\n🎉 모든 테스트를 통과했습니다!")
    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        import traceback

        traceback.print_exc()
