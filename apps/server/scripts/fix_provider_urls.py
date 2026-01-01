import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.session import SessionLocal
# Import User model to ensure relationships are registered correctly
from db.models.user import User 
from db.models.llm import LLMProvider

def fix_provider_urls():
    db = SessionLocal()
    try:
        updated_count = 0
        
        # 1. Google (User requested update)
        google = db.query(LLMProvider).filter(LLMProvider.name == "google").first()
        if google:
            google.doc_url = "https://aistudio.google.com/"
            updated_count += 1
            
        # 2. OpenAI
        openai = db.query(LLMProvider).filter(LLMProvider.name == "openai").first()
        if openai:
            openai.doc_url = "https://platform.openai.com/api-keys"
            updated_count += 1
            
        # 3. Anthropic
        anthropic = db.query(LLMProvider).filter(LLMProvider.name == "anthropic").first()
        if anthropic:
            anthropic.doc_url = "https://console.anthropic.com/settings/keys"
            updated_count += 1
            
        db.commit()
        print(f"✅ Successfully updated {updated_count} provider URLs.")
        
    except Exception as e:
        print(f"❌ Failed to update urls: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    fix_provider_urls()
