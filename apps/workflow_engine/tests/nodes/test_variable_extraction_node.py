import unittest

from apps.workflow_engine.workflow.nodes.variable_extraction.entities import (
    VariableExtractionMapping,
    VariableExtractionNodeData,
)
from apps.workflow_engine.workflow.nodes.variable_extraction.variable_extraction_node import (
    VariableExtractionNode,
)


class TestVariableExtractionNode(unittest.TestCase):
    def test_extract_mapped_values(self):
        data = VariableExtractionNodeData(
            title="Variable Extract",
            source_selector=["source-node", "data"],
            mappings=[
                VariableExtractionMapping(
                    name="discount_revenue", json_path="discount_revenue"
                ),
                VariableExtractionMapping(
                    name="first_item_id", json_path="items[0].id"
                ),
                VariableExtractionMapping(
                    name="missing_value", json_path="missing.key"
                ),
            ],
        )

        node = VariableExtractionNode(id="var-node", data=data)
        inputs = {
            "source-node": {
                "data": {"discount_revenue": 1200, "items": [{"id": "A1"}]}
            }
        }

        result = node.execute(inputs)
        self.assertEqual(result["discount_revenue"], 1200)
        self.assertEqual(result["first_item_id"], "A1")
        self.assertIsNone(result["missing_value"])

    def test_parse_json_string_input(self):
        data = VariableExtractionNodeData(
            title="Variable Extract",
            source_selector=["source-node", "data"],
            mappings=[
                VariableExtractionMapping(name="total", json_path="total"),
            ],
        )

        node = VariableExtractionNode(id="var-node", data=data)
        inputs = {"source-node": {"data": '{"total": 42}'}}

        result = node.execute(inputs)
        self.assertEqual(result["total"], 42)


if __name__ == "__main__":
    unittest.main()
