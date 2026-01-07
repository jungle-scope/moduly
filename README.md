## 🗄️ 데이터베이스 마이그레이션

이 프로젝트는 **Alembic**을 사용하여 데이터베이스 스키마를 관리합니다.

### 최초 설정

```bash
# 마이그레이션 적용
alembic upgrade head
```

### 모델 변경 시

```bash
# 마이그레이션 생성
alembic revision --autogenerate -m "Description"

# 적용
alembic upgrade head
```

자세한 내용은 [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)를 참고하세요.