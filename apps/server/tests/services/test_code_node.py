"""
Code Node 테스트

실행 방법:
    cd apps/server
    .venv\Scripts\python.exe tests/services/test_code_node.py
"""

import os
import sys
import unittest

# Add project root to sys.path
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from workflow.nodes.code import CodeNode, CodeNodeData, CodeNodeInput


class TestCodeNode(unittest.TestCase):
    def test_simple_code_execution(self):
        """간단한 코드 실행 테스트"""
        print("\n📝 테스트: 간단한 코드 실행")

        # Given: 덧셈 코드
        code = """
def main(inputs):
    return {"result": inputs['a'] + inputs['b']}
"""
        node_data = CodeNodeData(
            title="덧셈 노드",
            code=code,
            inputs=[
                CodeNodeInput(name="a", source="Start.num1"),
                CodeNodeInput(name="b", source="Start.num2"),
            ],
        )
        node = CodeNode(id="code-1", data=node_data)

        # When: 노드 실행
        inputs = {"Start": {"num1": 5, "num2": 3}}
        result = node.execute(inputs)

        # Then: 결과 검증
        self.assertNotIn("error", result)
        self.assertEqual(result["result"], 8)
        print("✅ 통과")

    def test_string_processing(self):
        """문자열 처리 테스트"""
        print("\n📝  테스트: 문자열 처리")

        code = """
def main(inputs):
    text = inputs['text']
    return {
        "upper": text.upper(),
        "length": len(text),
        "reversed": text[::-1]
    }
"""
        node_data = CodeNodeData(
            title="문자열 처리",
            code=code,
            inputs=[CodeNodeInput(name="text", source="Start.message")],
        )
        node = CodeNode(id="code-1", data=node_data)

        inputs = {"Start": {"message": "hello"}}
        result = node.execute(inputs)

        self.assertEqual(result["upper"], "HELLO")
        self.assertEqual(result["length"], 5)
        self.assertEqual(result["reversed"], "olleh")
        print("✅ 통과")

    def test_missing_variable_error(self):
        """존재하지 않는 변수 참조 시 에러 반환"""
        print("\n📝 테스트: 누락된 변수 에러")

        code = """
def main(inputs):
    return {"result": inputs['value']}
"""
        node_data = CodeNodeData(
            title="에러 테스트",
            code=code,
            inputs=[CodeNodeInput(name="value", source="Start.nonexistent")],
        )
        node = CodeNode(id="code-1", data=node_data)

        inputs = {"Start": {"existing": "hello"}}
        result = node.execute(inputs)

        self.assertIn("error", result)
        self.assertIn("not found", result["error"].lower())
        print(f"   에러 메시지: {result['error']}")
        print("✅ 통과")

    def test_runtime_error_handling(self):
        """코드 실행 중 에러 처리"""
        print("\n📝 테스트: 런타임 에러 처리")

        code = """
def main(inputs):
    return {"result": 1 / 0}  # Division by zero
"""
        node_data = CodeNodeData(title="에러 코드", code=code, inputs=[])
        node = CodeNode(id="code-1", data=node_data)

        inputs = {}
        result = node.execute(inputs)

        self.assertIn("error", result)
        print(f"   에러 메시지: {result['error']}")
        print("✅ 통과")

    def test_multiple_inputs(self):
        """여러 입력 변수 처리"""
        print("\n📝 테스트: 여러 입력 변수")

        code = """
def main(inputs):
    return {
        "greeting": f"Hello, {inputs['name']}!",
        "age_next_year": inputs['age'] + 1,
        "is_adult": inputs['age'] >= 18
    }
"""
        node_data = CodeNodeData(
            title="프로필 처리",
            code=code,
            inputs=[
                CodeNodeInput(name="name", source="Start.userName"),
                CodeNodeInput(name="age", source="Start.userAge"),
            ],
        )
        node = CodeNode(id="code-1", data=node_data)

        inputs = {"Start": {"userName": "Alice", "userAge": 25}}
        result = node.execute(inputs)

        self.assertEqual(result["greeting"], "Hello, Alice!")
        self.assertEqual(result["age_next_year"], 26)
        self.assertEqual(result["is_adult"], True)
        print("✅ 통과")


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Code Node 테스트 시작")
    print("=" * 60)

    suite = unittest.TestLoader().loadTestsFromTestCase(TestCodeNode)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    if result.wasSuccessful():
        print("🎉 모든 테스트 통과!")
    else:
        print("❌ 일부 테스트 실패")
    print("=" * 60)

    sys.exit(0 if result.wasSuccessful() else 1)
