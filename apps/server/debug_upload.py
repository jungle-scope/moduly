import requests

API_BASE = "http://localhost:8000/api/v1"


def test_upload_manual():
    # 1. Login
    login_url = f"{API_BASE}/auth/login"
    login_data = {"email": "dev@moduly.app", "password": "dev-password"}

    sess = requests.Session()
    print(f"Logging in to {login_url}...")
    try:
        resp = sess.post(login_url, json=login_data)
        if resp.status_code != 200:
            print(f"Login failed: {resp.status_code} {resp.text}")
            return
        print("Login successful.")
    except Exception as e:
        print(f"Login request failed: {e}")
        return

    # 2. Upload
    url = f"{API_BASE}/rag/upload"

    # 임시 파일 생성
    with open("debug_test.txt", "w") as f:
        f.write("Debug Upload Test Content")

    files = {"file": open("debug_test.txt", "rb")}
    data = {"knowledgeBaseId": "", "sourceType": "FILE"}

    try:
        print(f"Sending POST request to {url}...")
        response = sess.post(url, files=files, data=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")


if __name__ == "__main__":
    test_upload_manual()
