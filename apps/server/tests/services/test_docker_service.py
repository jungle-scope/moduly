"""
Docker Sandbox Service 테스트

주의: Docker Desktop이 실행 중이어야 합니다.

실행 방법:
    cd apps/server
    .venv\Scripts\python.exe tests/services/test_docker_service.py
"""

import os
import sys
import unittest

# Add project root to sys.path
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from services.docker_service import DockerSandboxService


class TestDockerSandboxService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """모든 테스트 전에 한 번 실행"""
        print("\n" + "=" * 60)
        print("Docker Sandbox Service 테스트 준비 중...")
        print("=" * 60)
        cls.service = DockerSandboxService()

    def test_simple_addition(self):
        """간단한 덧셈 코드 실행"""
        print("\n📝 테스트: 간단한 덧셈")
        code = """
def main(inputs):
    return {"result": inputs['a'] + inputs['b']}
"""
        result = self.service.execute_python_code(code, {"a": 1, "b": 2})

        self.assertNotIn("error", result)
        self.assertEqual(result["result"], 3)
        print("✅ 통과")

    def test_string_manipulation(self):
        """문자열 처리 테스트"""
        print("\n📝 테스트: 문자열 처리")
        code = """
def main(inputs):
    text = inputs['text']
    return {
        "upper": text.upper(),
        "lower": text.lower(),
        "length": len(text)
    }
"""
        result = self.service.execute_python_code(code, {"text": "Hello World"})

        self.assertEqual(result["upper"], "HELLO WORLD")
        self.assertEqual(result["lower"], "hello world")
        self.assertEqual(result["length"], 11)
        print("✅ 통과")

    def test_error_handling(self):
        """에러 발생 시 에러 메시지 반환"""
        print("\n📝 테스트: 에러 핸들링")
        code = """
def main(inputs):
    return inputs['nonexistent_key']
"""
        result = self.service.execute_python_code(code, {"key": "value"})

        self.assertIn("error", result)
        print(f"   에러 메시지: {result['error']}")
        print("✅ 통과")

    def test_invalid_return_type(self):
        """리턴 타입이 dict가 아닌 경우"""
        print("\n📝 테스트: 잘못된 리턴 타입")
        code = """
def main(inputs):
    return "not a dict"
"""
        result = self.service.execute_python_code(code, {})

        self.assertIn("error", result)
        self.assertIn("must return a dict", result["error"])
        print("✅ 통과")

    def test_network_isolation(self):
        """네트워크 접근 차단 확인 (중요!)"""
        print("\n📝 테스트: 네트워크 격리")
        code = """
def main(inputs):
    import urllib.request
    try:
        urllib.request.urlopen('http://google.com', timeout=1)
        return {"result": "Network accessible - FAIL"}
    except Exception as e:
        return {"result": "Network blocked - PASS", "error_type": type(e).__name__}
"""
        result = self.service.execute_python_code(code, {})

        # 네트워크가 차단되어야 하므로 예외가 발생해야 함
        self.assertEqual(result["result"], "Network blocked - PASS")
        print(f"   네트워크 차단 확인: {result['error_type']}")
        print("✅ 통과")

    def test_filesystem_readonly(self):
        """파일시스템 쓰기 차단 확인 (중요!)"""
        print("\n📝 테스트: 읽기 전용 파일시스템")
        code = """
def main(inputs):
    try:
        with open('/etc/test.txt', 'w') as f:
            f.write('test')
        return {"result": "Write succeeded - FAIL"}
    except Exception as e:
        return {"result": "Write blocked - PASS", "error_type": type(e).__name__}
"""
        result = self.service.execute_python_code(code, {})

        # 읽기 전용이므로 쓰기가 차단되어야 함
        self.assertEqual(result["result"], "Write blocked - PASS")
        print(f"   쓰기 차단 확인: {result['error_type']}")
        print("✅ 통과")

    def test_tmpfs_writable(self):
        """/tmp는 쓰기 가능 (tmpfs) 확인"""
        print("\n📝 테스트: tmpfs 쓰기 가능")
        code = """
def main(inputs):
    import tempfile
    try:
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.write('test')
            return {"result": "tmpfs writable - PASS", "path": f.name}
    except Exception as e:
        return {"result": "tmpfs not writable - FAIL", "error": str(e)}
"""
        result = self.service.execute_python_code(code, {})

        # /tmp는 tmpfs로 마운트되어 쓰기 가능해야 함
        self.assertEqual(result["result"], "tmpfs writable - PASS")
        print(f"   tmpfs 경로: {result.get('path')}")
        print("✅ 통과")


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Docker Sandbox Service 테스트 시작")
    print("=" * 60)
    print()

    # 테스트 실행
    suite = unittest.TestLoader().loadTestsFromTestCase(TestDockerSandboxService)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # 결과 요약
    print("\n" + "=" * 60)
    if result.wasSuccessful():
        print("🎉 모든 테스트 통과!")
    else:
        print("❌ 일부 테스트 실패")
        print(f"   실패: {len(result.failures)}")
        print(f"   에러: {len(result.errors)}")
    print("=" * 60)

    sys.exit(0 if result.wasSuccessful() else 1)
