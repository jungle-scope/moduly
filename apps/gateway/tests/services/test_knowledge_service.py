"""
Knowledge Base / Document 모델 단위 테스트
DB 세션 없이 객체 생성 및 기본 로직만 검증합니다.
"""

from uuid import uuid4

from apps.shared.db.models.knowledge import Document, DocumentChunk, KnowledgeBase


def test_knowledge_base_creation():
    """KnowledgeBase 객체 생성 및 필수 필드 검증"""
    # Given
    kb_id = uuid4()
    user_id = uuid4()

    # When
    kb = KnowledgeBase(
        id=kb_id,
        user_id=user_id,
        name="테스트 지식 베이스",
        description="단위 테스트용 KB",
        embedding_model="text-embedding-3-small",
        top_k=5,
        similarity_threshold=0.7,
    )

    # Then
    assert kb.id == kb_id
    assert kb.user_id == user_id
    assert kb.name == "테스트 지식 베이스"
    assert kb.embedding_model == "text-embedding-3-small"
    assert kb.top_k == 5
    assert kb.similarity_threshold == 0.7


def test_knowledge_base_with_all_fields():
    """KnowledgeBase 모든 필드 명시적 설정 확인"""
    # Given/When
    kb = KnowledgeBase(
        id=uuid4(),
        user_id=uuid4(),
        name="전체 필드 테스트",
        embedding_model="custom-model",
        top_k=10,
        similarity_threshold=0.8,
    )

    # Then
    assert kb.embedding_model == "custom-model"
    assert kb.top_k == 10
    assert kb.similarity_threshold == 0.8


def test_document_creation():
    """Document 객체 생성 및 필수 필드 검증"""
    # Given
    doc_id = uuid4()
    kb_id = uuid4()

    # When
    doc = Document(
        id=doc_id,
        knowledge_base_id=kb_id,
        filename="test.pdf",
        file_path="/uploads/test.pdf",
        status="pending",
        chunk_size=1000,
        chunk_overlap=200,
    )

    # Then
    assert doc.id == doc_id
    assert doc.knowledge_base_id == kb_id
    assert doc.filename == "test.pdf"
    assert doc.status == "pending"
    assert doc.chunk_size == 1000
    assert doc.chunk_overlap == 200


def test_document_with_all_fields():
    """Document 모든 필드 명시적 설정 확인"""
    # Given/When
    doc = Document(
        id=uuid4(),
        knowledge_base_id=uuid4(),
        filename="test.pdf",
        file_path="/uploads/test.pdf",
        status="completed",
        chunk_size=2000,
        chunk_overlap=400,
    )

    # Then
    assert doc.status == "completed"
    assert doc.chunk_size == 2000
    assert doc.chunk_overlap == 400


def test_document_with_error():
    """Document 실패 상태 및 에러 메시지"""
    # Given/When
    doc = Document(
        id=uuid4(),
        knowledge_base_id=uuid4(),
        filename="error.pdf",
        file_path="/uploads/error.pdf",
        status="failed",
        error_message="파일 파싱 실패: 손상된 PDF",
    )

    # Then
    assert doc.status == "failed"
    assert doc.error_message == "파일 파싱 실패: 손상된 PDF"


def test_document_chunk_creation():
    """DocumentChunk 객체 생성 및 필드 검증"""
    # Given
    chunk_id = uuid4()
    doc_id = uuid4()
    kb_id = uuid4()

    # When
    chunk = DocumentChunk(
        id=chunk_id,
        document_id=doc_id,
        knowledge_base_id=kb_id,
        content="이것은 테스트 청크입니다.",
        embedding=[0.1, 0.2, 0.3],  # 간단한 벡터
        chunk_index=0,
        token_count=10,
        metadata_={"page": 1},
    )

    # Then
    assert chunk.id == chunk_id
    assert chunk.document_id == doc_id
    assert chunk.knowledge_base_id == kb_id
    assert chunk.content == "이것은 테스트 청크입니다."
    assert chunk.chunk_index == 0
    assert chunk.token_count == 10
    assert chunk.metadata_["page"] == 1


def test_document_chunk_with_all_fields():
    """DocumentChunk 모든 필드 명시적 설정 확인"""
    # Given/When
    chunk = DocumentChunk(
        id=uuid4(),
        document_id=uuid4(),
        knowledge_base_id=uuid4(),
        content="전체 필드 테스트",
        embedding=[0.5, 0.6],
        chunk_index=5,
        token_count=50,
        metadata_={"source": "test"},
    )

    # Then
    assert chunk.chunk_index == 5
    assert chunk.token_count == 50
    assert chunk.metadata_["source"] == "test"
