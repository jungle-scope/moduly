from typing import List, Literal, Optional

from sqlalchemy.orm import Session

from apps.gateway.services.wizard.code_gen import generate_code
from apps.gateway.services.wizard.prompt_imp import improve_prompt
from apps.gateway.services.wizard.template_imp import improve_template


class WizardService:
    """
    위저드 서비스 Facade.
    하위 모듈(code_gen, prompt_imp, template_imp)로 요청을 위임합니다.
    """

    @classmethod
    async def generate_code(
        cls,
        db: Session,
        user_id: int,
        description: str,
        input_variables: List[str],
    ) -> str:
        return await generate_code(db, user_id, description, input_variables)

    @classmethod
    async def improve_prompt(
        cls,
        db: Session,
        user_id: int,
        prompt_type: Literal["system", "user", "assistant"],
        original_prompt: str,
    ) -> str:
        return await improve_prompt(db, user_id, prompt_type, original_prompt)

    @classmethod
    async def improve_template(
        cls,
        db: Session,
        user_id: int,
        template_type: Literal["email", "message", "report", "custom"],
        original_template: str,
        registered_variables: List[str],
        custom_instructions: Optional[str] = None,
    ) -> str:
        return await improve_template(
            db,
            user_id,
            template_type,
            original_template,
            registered_variables,
            custom_instructions,
        )
