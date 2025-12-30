from uuid import uuid4

from db.models.knowledge import Document, KnowledgeBase

"""
[테스트 범위 설명]
이 파일은 '지식 베이스 메타데이터 관리(CRUD)' API를 테스트합니다.
데이터 생성을 엔드포인트(/rag/upload)가 아닌 DB 직접 삽입(db_session.add) 방식으로 수행하므로,
실제 LLM/임베딩 API(OpenAI 등)는 호출되지 않습니다.

따라서 embedding_model="test-model"과 같이 실제 존재하지 않는 모델명을 사용해도
테스트에는 문제가 없으며, 오직 DB 입출력 및 응답 스키마가 올바른지만 검증합니다.

※ 추후 파일 업로드(Ingestion) 로직을 테스트할 때는 OpenAI 클라이언트를 Mocking 해야 합니다.
"""


def test_get_knowledge_list_empty(client):
    """지식 베이스가 없을 때 빈 목록 반환 테스트"""
    response = client.get("/api/v1/knowledge")
    assert response.status_code == 200
    assert response.json() == []


def test_get_knowledge_list_with_data(client, db_session, test_user_id):
    """지식 베이스 목록 조회 테스트"""
    # Given: KB 생성
    kb_id = uuid4()
    kb = KnowledgeBase(
        id=kb_id,
        user_id=test_user_id,
        name="테스트 지식 베이스",
        description="설명입니다",
        embedding_model="test-model",
    )
    db_session.add(kb)
    db_session.commit()

    # When
    response = client.get("/api/v1/knowledge")

    # Then
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "테스트 지식 베이스"
    assert data[0]["document_count"] == 0


def test_get_knowledge_detail(client, db_session, test_user_id):
    """지식 베이스 상세 조회 테스트"""
    # Given: KB 및 문서 생성
    kb_id = uuid4()
    kb = KnowledgeBase(
        id=kb_id,
        user_id=test_user_id,
        name="상세 조회용 KB",
        embedding_model="test-model",
    )
    db_session.add(kb)
    db_session.commit()

    doc = Document(
        id=uuid4(),
        knowledge_base_id=kb_id,
        filename="test.pdf",
        file_path="/tmp/test.pdf",
        status="completed",
    )
    db_session.add(doc)
    db_session.commit()

    # When
    response = client.get(f"/api/v1/knowledge/{kb_id}")

    # Then
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "상세 조회용 KB"
    assert len(data["documents"]) == 1
    assert data["documents"][0]["filename"] == "test.pdf"


def test_update_knowledge_base(client, db_session, test_user_id):
    """지식 베이스 수정 테스트 (PATCH)"""
    # Given
    kb_id = uuid4()
    kb = KnowledgeBase(
        id=kb_id,
        user_id=test_user_id,
        name="수정 전 이름",
        description="수정 전 설명",
        embedding_model="test-model",
    )
    db_session.add(kb)
    db_session.commit()

    # When
    update_data = {"name": "수정 후 이름", "description": "수정 후 설명"}
    response = client.patch(f"/api/v1/knowledge/{kb_id}", json=update_data)

    # Then
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "수정 후 이름"
    assert data["description"] == "수정 후 설명"

    # DB 확인
    db_kb = db_session.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    assert db_kb.name == "수정 후 이름"
