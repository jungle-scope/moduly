import os
import sys

# Set module path to root of server app
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../apps/server"))
)

from db.models.knowledge import SourceType
from services.ingestion.factory import IngestionFactory
from services.ingestion.processors.api_processor import ApiProcessor
from services.ingestion.processors.db_processor import DbProcessor
from services.ingestion.processors.file_processor import FileProcessor


class MockSession:
    pass


def test_factory():
    print("Testing IngestionFactory...")
    session = MockSession()

    # Test FILE
    p1 = IngestionFactory.get_processor(SourceType.FILE, session)
    assert isinstance(p1, FileProcessor)
    print("✅ FILE Processor created")

    # Test API
    p2 = IngestionFactory.get_processor(SourceType.API, session)
    assert isinstance(p2, ApiProcessor)
    print("✅ API Processor created")

    # Test DB
    p3 = IngestionFactory.get_processor(SourceType.DB, session)
    assert isinstance(p3, DbProcessor)
    print("✅ DB Processor created")

    print("\nVerifying Interfaces...")
    for p in [p1, p2, p3]:
        assert hasattr(p, "process")
        assert hasattr(p, "analyze")
        print(f"✅ {p.__class__.__name__} has required methods")


if __name__ == "__main__":
    try:
        test_factory()
        print("\n🎉 All Factory Tests Passed!")
    except Exception as e:
        print(f"\n❌ Test Failed: {e}")
        sys.exit(1)
