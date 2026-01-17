from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.services.llm_service import LLMService
from apps.shared.db.models.llm import LLMModel, LLMProvider, LLMUsageLog
from apps.shared.db.models.user import User
from apps.shared.db.session import get_db
from apps.shared.schemas.llm import (
    LLMCredentialCreate,
    LLMCredentialResponse,
    LLMModelPricingUpdate,
    LLMModelResponse,
    LLMProviderResponse,
)

router = APIRouter()

# --- Providers (System) ---


@router.get("/providers", response_model=List[LLMProviderResponse])
def get_system_providers(db: Session = Depends(get_db)):
    """
    List all system-defined LLM providers and their models.
    """
    try:
        return LLMService.get_system_providers(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# --- Credentials (User) ---


@router.get("/my-models", response_model=List[LLMModelResponse])
def get_my_models(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    List all models available to the current user.
    """
    try:
        return LLMService.get_my_available_models(db, current_user.id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/my-embedding-models", response_model=List[LLMModelResponse])
def get_my_embedding_models(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    현재 사용자가 사용 가능한 임베딩 모델 목록 조회.
    """
    try:
        return LLMService.get_my_embedding_models(db, current_user.id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/credentials", response_model=List[LLMCredentialResponse])
def get_my_credentials(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    List all credentials for the current user.
    """
    try:
        return LLMService.get_user_credentials(db, current_user.id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/credentials", response_model=LLMCredentialResponse)
def register_credential(
    request: LLMCredentialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Register a new API Key for a specific provider.
    """
    try:
        return LLMService.register_credential(db, current_user.id, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/credentials/{credential_id}")
def delete_credential(
    credential_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a user credential.
    """
    try:
        deleted = LLMService.delete_credential(db, credential_id, current_user.id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Credential not found")
        return {"message": "Credential deleted", "id": str(credential_id)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/credentials/{credential_id}/sync-models")
def sync_credential_models(
    credential_id: UUID,
    purge_unverified: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    해당 크리덴셜 기준으로 모델 매핑을 재동기화합니다.
    """
    try:
        return LLMService.sync_credential_models(
            db, current_user.id, credential_id, purge_unverified=purge_unverified
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# --- Stats ---


@router.get("/stats/top-models")
def get_top_expensive_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get Top 3 expensive models for the current month (user-scoped).
    각 사용자의 본인 사용량 기준으로 Top 3 모델을 반환합니다.
    """
    try:
        # 1. Determine date range (This Month in UTC mostly, or naive)
        now = datetime.now()
        start_of_month = datetime(now.year, now.month, 1)

        # 2. Query (User-scoped)
        # Join Log -> Model -> Provider
        # Group by Model, filtered by current user
        results = (
            db.query(
                LLMModel.name.label("model_name"),
                LLMProvider.name.label("provider_name"),
                func.sum(LLMUsageLog.total_cost).label("total_cost"),
                func.sum(
                    LLMUsageLog.prompt_tokens + LLMUsageLog.completion_tokens
                ).label("total_tokens"),
            )
            .join(LLMModel, LLMUsageLog.model_id == LLMModel.id)
            .join(LLMProvider, LLMModel.provider_id == LLMProvider.id)
            .filter(LLMUsageLog.created_at >= start_of_month)
            .filter(LLMUsageLog.user_id == current_user.id)  # 사용자별 필터링
            .group_by(LLMModel.id, LLMModel.name, LLMProvider.id, LLMProvider.name)
            .order_by(desc("total_cost"))
            .limit(3)
            .all()
        )

        # 3. Format Response
        response = []
        for r in results:
            response.append(
                {
                    "model_name": r.model_name,
                    "provider_name": r.provider_name,
                    "total_cost": float(r.total_cost) if r.total_cost else 0.0,
                    "total_tokens": int(r.total_tokens) if r.total_tokens else 0,
                }
            )

        return response

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# --- Pricing Management ---


@router.post("/models/sync-pricing")
def sync_system_pricing(
    db: Session = Depends(get_db),
    # Optional: Admin only
):
    """
    [Admin] Sync all DB models with hardcoded system prices.
    Useful when system price list is updated.
    """
    try:
        result = LLMService.sync_system_prices(db)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/models/{model_id}/pricing")
def update_model_pricing(
    model_id: UUID,
    pricing: LLMModelPricingUpdate,
    db: Session = Depends(get_db),
    # Optional: Admin only
):
    """
    [Admin] Manually update pricing for a specific model.
    """
    try:
        model = LLMService.update_model_pricing(
            db, model_id, pricing.input_price_1k, pricing.output_price_1k
        )
        return {"message": "Pricing updated", "model": model.name}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
