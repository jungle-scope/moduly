import sys
import os
import requests
import json

# Set up path to import from apps/server
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.llm_client.google_client import GoogleClient

def test_google():
    print("=== Google Gemini Connectivity & Model ID Test ===")
    api_key = input("Enter your Google Gemini API Key: ").strip()
    if not api_key:
        print("API Key is required.")
        return

    base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
    
    # 1. Fetch Models List
    print(f"\n[Step 1] Fetching available models from {base_url}models ...")
    try:
        resp = requests.get(
            base_url.rstrip("/") + "/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            models = data.get("data", [])
            print(f"SUCCESS: Found {len(models)} models.")
            ids = [m['id'] for m in models]
            print("First 5 stored IDs:", ids[:5])
            
            # Check for gemini-1.5-flash
            has_1_5 = any("gemini-1.5-flash" in mid for mid in ids)
            print(f"Contains 'gemini-1.5-flash'? {has_1_5}")
        else:
            print(f"FAILED to list models: {resp.status_code} {resp.text}")
            return
    except Exception as e:
        print(f"Exception listing models: {e}")
        return

    # 2. Test Invocation with multiple ID formats
    test_target_base = "gemini-1.5-flash"
    
    ids_to_test = [
        f"models/{test_target_base}", # What DB stores
        test_target_base,             # Stripped
        "gemini-2.0-flash-exp",       # Alternative if 1.5 missing
        "models/gemini-2.0-flash-exp"
    ]
    
    print(f"\n[Step 2] Testing Invocation...")
    
    for mid in ids_to_test:
        print(f"\n------------------------------------------------")
        print(f"Testing Model ID: '{mid}'")
        
        client = GoogleClient(
            model_id=mid, 
            credentials={"apiKey": api_key, "baseUrl": base_url}
        )
        
        messages = [{"role": "user", "content": "Hi"}]
        
        try:
            response = client.invoke(messages)
            content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"[SUCCESS] Reply: {content[:50]}...")
            print(">>> CONCLUSION: This ID format IS valid.")
        except Exception as e:
            print(f"[FAILED] {e}")
            if "404" in str(e):
                 print(">>> CONCLUSION: ID format likely rejected or model not found.")

if __name__ == "__main__":
    test_google()
