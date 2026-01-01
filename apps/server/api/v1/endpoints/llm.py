from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from db.session import get_db
from db.models.user import User
from auth.dependencies import get_current_user
from schemas.llm import (
    LLMProviderResponse,
    LLMCredentialCreate,
    LLMCredentialResponse,
    LLMModelResponse
)
from services.llm_service import LLMService

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all models available to the current user.
    """
    try:
        return LLMService.get_my_available_models(db, current_user.id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/credentials", response_model=List[LLMCredentialResponse])
def get_my_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
