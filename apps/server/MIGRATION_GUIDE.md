# 🔄 Alembic 데이터베이스 마이그레이션 가이드

## 📋 목차
- [최초 설정 (신규 팀원용)](#최초-설정-신규-팀원용)
- [일상적인 사용](#일상적인-사용)
- [모델 변경 시 (개발자용)](#모델-변경-시-개발자용)
- [트러블슈팅](#트러블슈팅)

---

## 🔄 일상적인 사용

### **⭐ 코드 업데이트 받았을 때**

```bash
# 1. 최신 코드 가져오기
git pull origin develop

# 2. 의존성 업데이트 확인
pip install -r requirements. txt

# 3. ⭐ 새 마이그레이션 적용
alembic upgrade head

# 4. 서버 재시작
uvicorn main:app --reload
```

### **현재 DB 버전 확인**

```bash
alembic current
```

**출력 예시:**
```
0a7801a076d3 (head)
```

### **마이그레이션 히스토리 확인**

```bash
alembic history
```

---

## 🛠️ 모델 변경 시 (개발자용)

### **1. 모델 수정**

```python
# 예:  db/models/user.py
class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID, primary_key=True)
    email = Column(String(255), nullable=False)
    name = Column(String(255))
    phone_number = Column(String(20))  # ← 새로 추가
```

### **2. 마이그레이션 생성**

```bash
alembic revision --autogenerate -m "Add phone_number to User"
```

**생성된 파일 확인:**
```bash
# alembic/versions/abc123_add_phone_number_to_user.py
ls -la alembic/versions/
```

### **3. 마이그레이션 파일 검토**

```bash
# 생성된 파일 열기
code alembic/versions/abc123_add_phone_number_to_user.py
```

**확인 사항:**
- `upgrade()`: 변경사항이 올바른지 확인
- `downgrade()`: 롤백 로직이 올바른지 확인

### **4. 로컬에서 테스트**

```bash
# 적용
alembic upgrade head

# 확인
alembic current

# 롤백 테스트
alembic downgrade -1

# 다시 적용
alembic upgrade head
```

### **5. 커밋 & 푸시**

```bash
git add alembic/versions/abc123_add_phone_number_to_user.py
git commit -m "feat: Add phone_number column to User table"
git push origin develop
```

---

## 🔧 고급 사용법

### **특정 버전으로 이동**

```bash
# 특정 리비전으로 업그레이드
alembic upgrade abc123

# 특정 리비전으로 다운그레이드
alembic downgrade abc123

# 한 단계 ���돌리기
alembic downgrade -1

# 모두 되돌리기
alembic downgrade base
```

### **마이그레이션 병합**

```bash
# 여러 브랜치에서 마이그레이션이 충돌할 때
alembic merge -m "Merge migrations" head1 head2
```

### **현재 DB와 모델 차이 확인**

```bash
# 자동 생성 없이 확인만
alembic revision --autogenerate -m "Check" --sql

# 생성된 SQL 확인 후 파일 삭제
rm alembic/versions/*_check.py
```

---

## 🚨 트러블슈팅

### **1. "No module named 'psycopg2'"**

```bash
# 가상환경 재확인
which python
# /path/to/moduly/apps/server/. venv/bin/python 이어야 함

# psycopg2 재설치
pip install psycopg2-binary
```

---

### **2. "Can't locate revision identified by 'abc123'"**

**원인:** 마이그레이션 파일이 없거나 체인이 끊어짐

**해결:**
```bash
# 1. 모든 마이그레이션 파일 확인
ls -la alembic/versions/

# 2. 최신 코드 가져오기
git pull origin develop

# 3. DB 버전 확인
alembic current

# 4. 강제로 현재 버전 설정 (주의!)
alembic stamp head
```

---

### **3. "Target database is not up to date"**

```bash
# 대기 중인 마이그레이션 적용
alembic upgrade head
```

---

### **4. 마이그레이션 충돌**

**여러 브랜치에서 동시에 마이그레이션 생성했을 때:**

```bash
# 1. 현재 상태 확인
alembic heads

# 2. 충돌하는 마이그레이션 병합
alembic merge -m "Merge conflicting migrations" head1 head2

# 3. 병합 마이그레이션 적용
alembic upgrade head
```

---

### **5. "Detected type change" 경고 무시하기**

**사소한 차이 (VARCHAR vs TEXT 등)를 무시하려면:**

`alembic/env.py`에서:
```python
context.configure(
    ... 
    compare_type=False,  # 타입 변경 무시
)
```

---

## 📊 마이그레이션 베스트 프랙티스

### ✅ 해야 할 것

1. **작은 단위로 마이그레이션 생성**
   - 한 번에 하나의 변경사항만

2. **의미있는 메시지 사용**
   ```bash
   alembic revision --autogenerate -m "Add user_profile table"
   # ❌ -m "changes"
   ```

3. **생성된 파일 항상 검토**
   - 자동 생성이 완벽하지 않을 수 있음

4. **downgrade() 함수 테스트**
   ```bash
   alembic downgrade -1
   alembic upgrade head
   ```

5. **프로덕션 배포 전 테스트**

### ❌ 하지 말아야 할 것

1. **이미 푸시된 마이그레이션 수정하지 않기**
   - 새 마이그레이션으로 수정

2. **마이그레이션 파일 직접 삭제하지 않기**
   - `alembic downgrade`로 되돌리기

3. **production DB에서 `downgrade` 신중히 사용**
   - 데이터 손실 가능성

4. **마이그레이션 없이 모델만 변경하지 않기**
   - 항상 마이그레이션 생성

---

## 🔍 유용한 명령어 요약

```bash
# 현재 버전
alembic current

# 히스토리
alembic history

# 최신으로 업그레이드
alembic upgrade head

# 한 단계 되돌리기
alembic downgrade -1

# 마이그레이션 생성
alembic revision --autogenerate -m "Description"

# DB 버전 강제 설정 (주의!)
alembic stamp head
```

---

## 📞 도움이 필요하면

- Alembic 공식 문서:  https://alembic.sqlalchemy.org/
- SQLAlchemy 문서: https://docs.sqlalchemy.org/

---

## 📝 변경 이력

- 2026-01-07:  Alembic 초기 설정 및 가이드 작성