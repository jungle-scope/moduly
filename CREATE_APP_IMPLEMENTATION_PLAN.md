# createApp 함수 실제 구현 계획

`create-app-modal`에 정의된 임시 `createApp` 함수를 실제 백엔드 API와 연동하여 앱 생성 기능을 완성합니다.

## 현재 상태

현재 `createApp`은 다음과 같이 **모의(mock) 함수**로 구현되어 있습니다:

```typescript
// apps/client/app/features/app/components/create-app-modal/index.tsx

const createApp = async (data: {
  name: string;
  description: string;
  icon: string;
  icon_background: string;
}) => {
  console.log("API 요청 데이터:", data);
  return new Promise((resolve) => setTimeout(resolve, 800));
};
```

이를 실제 FastAPI 백엔드와 연동하여 PostgreSQL에 앱 데이터를 저장하도록 구현합니다.

---

## 아키텍처 개요

기존 `Workflow` 도메인과 동일한 계층 구조 패턴을 적용합니다:

```
Frontend (Next.js)                    Backend (FastAPI)
─────────────────                    ─────────────────
CreateAppModal
    ↓
appApi.ts  ──── HTTP POST ────→  app.py (endpoint)
                                         ↓
                                 app_service.py
                                         ↓
                                 App Model (SQLAlchemy)
                                         ↓
                                  PostgreSQL
```

---

## Proposed Changes

### 1. Backend - Schema

**[NEW] `apps/server/schemas/app.py`**

App 생성 요청/응답 스키마 정의:

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AppCreateRequest(BaseModel):
    """앱 생성 요청 스키마"""
    name: str
    description: Optional[str] = None
    icon: str
    icon_background: str


class AppResponse(BaseModel):
    """앱 응답 스키마"""
    id: str
    name: str
    description: Optional[str]
    icon: str
    icon_background: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

---

### 2. Backend - Database Model

**[NEW] `apps/server/db/models/app.py`**

App 테이블 모델 정의:

```python
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class App(Base):
    """
    앱 모델

    사용자가 생성한 AI 앱을 나타내는 테이블입니다.
    각 앱은 이름, 설명, 아이콘 정보를 가지며,
    추후 워크플로우와 연결될 수 있습니다.
    """
    __tablename__ = "apps"

    # === 기본 식별 필드 ===
    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)

    # === 앱 정보 필드 ===
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String(50), nullable=False)
    icon_background: Mapped[str] = mapped_column(String(20), nullable=False)

    # === 워크플로우 연결 ===
    workflow_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("workflows.id"), nullable=True
    )

    # === 앱 설정 필드 ===
    # 웹 앱 사이트 활성화 여부
    is_site_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # API 접근 활성화 여부
    is_api_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # 분당 요청 제한 (Requests Per Minute)
    api_requests_per_minute: Mapped[int] = mapped_column(Integer, default=60)
    # 시간당 요청 제한 (Requests Per Hour)
    api_requests_per_hour: Mapped[int] = mapped_column(Integer, default=3600)
    # 공개 앱 여부
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    # 트레이싱(추적) 설정 (JSON 형식 등)
    tracing_config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 최대 활성 요청 수
    max_active_requests: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # === 메타데이터 필드 ===
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # === 관계 (Relationships) ===
    # workflow = relationship("Workflow", back_populates="apps")
    # 주의: Workflow 모델에도 apps = relationship("App", back_populates="workflow") 추가 필요
```

**테이블 컬럼 설명:**

| 컬럼                      | 타입          | 설명                                    |
| ------------------------- | ------------- | --------------------------------------- |
| `id`                      | String (UUID) | Primary Key                             |
| `tenant_id`               | String        | 테넌트 ID                               |
| `name`                    | String(255)   | 앱 이름 (필수)                          |
| `description`             | Text          | 앱 설명 (선택)                          |
| `icon`                    | String(50)    | 앱 아이콘 이모지                        |
| `icon_background`         | String(20)    | 아이콘 배경색 (HEX)                     |
| `workflow_id`             | String (FK)   | 연결된 워크플로우 ID (선택)             |
| `is_site_enabled`         | Boolean       | 웹 앱 사이트 활성화 여부 (기본값: True) |
| `is_api_enabled`          | Boolean       | API 접근 활성화 여부 (기본값: True)     |
| `api_requests_per_minute` | Integer       | 분당 요청 제한 (기본값: 60)             |
| `api_requests_per_hour`   | Integer       | 시간당 요청 제한 (기본값: 3600)         |
| `is_public`               | Boolean       | 공개 앱 여부 (기본값: False)            |
| `tracing_config`          | Text          | 트레이싱 설정 (선택)                    |
| `max_active_requests`     | Integer       | 최대 활성 요청 수 (선택)                |
| `created_by`              | String        | 생성자 ID                               |
| `created_at`              | DateTime      | 생성 시간                               |
| `updated_at`              | DateTime      | 수정 시간                               |

---

### 3. Backend - Service Layer

**[NEW] `apps/server/services/app_service.py`**

App CRUD 로직을 담당하는 서비스 클래스:

```python
from sqlalchemy.orm import Session

from db.models.app import App
from schemas.app import AppCreateRequest


class AppService:
    @staticmethod
    def create_app(
        db: Session,
        request: AppCreateRequest,
        user_id: str = "default-user",
        tenant_id: str = "default-tenant",
    ):
        """
        새로운 앱을 생성합니다.

        Args:
            db: 데이터베이스 세션
            request: 앱 생성 요청 데이터
            user_id: 생성자 ID
            tenant_id: 테넌트 ID

        Returns:
            생성된 App 객체
        """
        app = App(
            tenant_id=tenant_id,
            name=request.name,
            description=request.description,
            icon=request.icon,
            icon_background=request.icon_background,
            created_by=user_id,
        )

        db.add(app)
        db.commit()
        db.refresh(app)

        print(f"✅ App created: {app.name} (ID: {app.id})")

        return app

    @staticmethod
    def get_app(db: Session, app_id: str):
        """앱을 ID로 조회합니다."""
        return db.query(App).filter(App.id == app_id).first()

    @staticmethod
    def list_apps(db: Session, tenant_id: str = "default-tenant"):
        """테넌트의 모든 앱을 조회합니다."""
        return db.query(App).filter(App.tenant_id == tenant_id).all()
```

---

### 4. Backend - API Endpoint

**[NEW] `apps/server/api/v1/endpoints/app.py`**

REST API 엔드포인트:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.app import AppCreateRequest, AppResponse
from services.app_service import AppService

router = APIRouter()


@router.post("", response_model=AppResponse)
def create_app(request: AppCreateRequest, db: Session = Depends(get_db)):
    """
    새로운 앱을 생성합니다.

    Args:
        request: 앱 생성 요청 데이터 (name, description, icon, icon_background)
        db: 데이터베이스 세션 (의존성 주입)

    Returns:
        생성된 앱 정보
    """
    return AppService.create_app(db, request)


@router.get("/{app_id}", response_model=AppResponse)
def get_app(app_id: str, db: Session = Depends(get_db)):
    """
    앱을 ID로 조회합니다.
    """
    app = AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    return app
```

---

### 5. Backend - Router Registration

**[MODIFY] `apps/server/api/api.py`**

App 라우터를 메인 API 라우터에 등록:

```diff
 from fastapi import APIRouter

 from api.v1.endpoints import workflow
+from api.v1.endpoints import app

 # 메인 API 라우터 생성
 api_router = APIRouter()

 # 워크플로우 엔드포인트 등록
 api_router.include_router(workflow.router, prefix="/workflows", tags=["workflows"])

+# 앱 엔드포인트 등록
+api_router.include_router(app.router, prefix="/apps", tags=["apps"])
```

---

### 6. Frontend - API Client

**[NEW] `apps/client/app/features/app/api/appApi.ts`**

백엔드 호출 함수:

```typescript
import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api/v1";

export interface CreateAppRequest {
  name: string;
  description: string;
  icon: string;
  icon_background: string;
}

export interface AppResponse {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  icon_background: string;
  created_at: string;
  updated_at: string;
}

export const appApi = {
  /**
   * 새로운 앱을 생성합니다.
   */
  createApp: async (data: CreateAppRequest): Promise<AppResponse> => {
    const response = await axios.post(`${API_BASE_URL}/apps`, data);
    return response.data;
  },

  /**
   * 앱을 ID로 조회합니다.
   */
  getApp: async (appId: string): Promise<AppResponse> => {
    const response = await axios.get(`${API_BASE_URL}/apps/${appId}`);
    return response.data;
  },
};
```

---

### 7. Frontend - Modal Integration

**[MODIFY] `apps/client/app/features/app/components/create-app-modal/index.tsx`**

임시 함수를 실제 API 호출로 교체:

```diff
 'use client';

 import React, { useState, useRef, useEffect, useCallback } from 'react';
 import { toast } from 'sonner';
+import { appApi } from '../api/appApi';
 import { AppIcon } from './app-icon';
 // ... 나머지 import

-// 임시 API 함수 (나중에 실제 서비스 파일로 이동해야 함)
-// 실제 백엔드 연동 전 UI 테스트를 위한 모의 함수입니다.
-const createApp = async (data: {
-  name: string;
-  description: string;
-  icon: string;
-  icon_background: string;
-}) => {
-  console.log('API 요청 데이터:', data);
-  // 네트워크 지연 효과 시뮬레이션 (0.8초)
-  return new Promise((resolve) => setTimeout(resolve, 800));
-};

 // handleCreate 내부에서:
-      await createApp({
+      await appApi.createApp({
         name: name.trim(),
         description: description.trim(),
         icon: appIcon.emoji,
         icon_background: appIcon.bg,
       });
```

---

## Verification Plan

### 1. 백엔드 단독 테스트 (cURL)

```bash
# 1. 백엔드 서버 시작
cd apps/server
uvicorn main:app --reload --port 8000

# 2. 앱 생성 API 테스트
curl -X POST http://localhost:8000/api/v1/apps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트 앱",
    "description": "테스트 설명",
    "icon": "🤖",
    "icon_background": "#FFEAD5"
  }'

# 예상 응답:
# {
#   "id": "uuid-string",
#   "name": "테스트 앱",
#   "description": "테스트 설명",
#   "icon": "🤖",
#   "icon_background": "#FFEAD5",
#   "created_at": "2025-12-27T...",
#   "updated_at": "2025-12-27T..."
# }
```

### 2. 프론트엔드 통합 테스트

1. **백엔드 서버 시작:**

   ```bash
   cd apps/server
   uvicorn main:app --reload --port 8000
   ```

2. **프론트엔드 개발 서버 시작:**

   ```bash
   cd apps/client
   npm run dev
   ```

3. **브라우저에서 테스트:**
   - `http://localhost:3000` 접속
   - 앱 생성 모달 열기
   - 앱 이름, 설명, 아이콘 입력
   - "생성" 버튼 클릭
   - 성공 토스트 메시지 확인
   - 백엔드 터미널에서 DB 저장 로그 확인

---

## 파일 변경 요약

| 구분     | 파일 경로                                                | 작업               |
| -------- | -------------------------------------------------------- | ------------------ |
| Backend  | `schemas/app.py`                                         | 신규 생성          |
| Backend  | `db/models/app.py`                                       | 신규 생성 ✅       |
| Backend  | `services/app_service.py`                                | 신규 생성          |
| Backend  | `api/v1/endpoints/app.py`                                | 신규 생성          |
| Backend  | `api/api.py`                                             | 수정 (라우터 등록) |
| Frontend | `app/features/app/api/appApi.ts`                         | 신규 생성          |
| Frontend | `app/features/app/components/create-app-modal/index.tsx` | 수정 (API 연동)    |

---

## 주의사항

- PostgreSQL 데이터베이스가 실행 중이어야 합니다 (`docker-compose up -d` 또는 로컬 PostgreSQL)
- 서버 시작 시 테이블이 자동으로 생성됩니다 (`Base.metadata.create_all`)
- CORS 설정이 `http://localhost:3000`을 허용하도록 되어 있습니다
- App 모델에는 워크플로우 연결 및 추가 설정 필드가 포함되어 있으나, 초기 생성 시에는 기본값으로 설정됩니다
