import os

from services.ingestion import IngestionService

# 1. 테스트할 파일 찾기 (apps/server/uploads)
upload_dir = "apps/server/uploads"
if not os.path.exists(upload_dir):
    print(f"'{upload_dir}' 폴더가 없습니다. 파일을 먼저 업로드해주세요.")
    exit()

files = [f for f in os.listdir(upload_dir) if f.endswith(".pdf")]

if not files:
    print("테스트할 PDF 파일이 없습니다! Step 1을 실행해서 파일을 업로드해주세요.")
    exit()

# 첫 번째 파일 선택
file_path = os.path.join(upload_dir, files[0])
print(f"📄 테스트 대상 문서: {files[0]}")

# 2. 파싱 서비스 준비 (DB는 필요없어서 None)
# _parse_pdf는 DB를 쓰지 않으므로 안전함
service = IngestionService(db=None)

# 3. 파싱 실행 (_parse_pdf는 내부함수지만 테스트위해 호출)
print("⏳ 파싱 중... (시간이 조금 걸릴 수 있습니다)")
results = service._parse_pdf(file_path)

# 4. 결과 출력
print("\n" + "=" * 50)
print(f"✅ 파싱 완료! 총 {len(results)} 페이지")
print("=" * 50 + "\n")

if results:
    first_page = results[0]
    print("[🔍 1페이지 마크다운 미리보기]\n")
    print("-" * 30)
    print(first_page["text"][:1000])  # 1000자까지만 출력
    print("-" * 30)
    print(f"\n... (생략된 {len(first_page['text']) - 1000}자)")
else:
    print("⚠️ 변환된 내용이 없습니다.")
