
import sys
import os

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from db.session import SessionLocal
from db.models.llm import LLMModel, LLMUsageLog
from db.models.workflow_run import WorkflowRun
from services.llm_service import LLMService

def fix_prices():
    db = SessionLocal()
    try:
        print("=== 1. Define Known Prices ===")
        # Same dictionary as added to LLMService
        KNOWN_PRICES = {
            "gpt-4o": {"input": 0.005, "output": 0.015},
            "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
            "gemini-1.5-flash": {"input": 0.00035, "output": 0.00105},
            "gemini-1.5-pro": {"input": 0.0035, "output": 0.0105},
            "gemini-2.0-flash-exp": {"input": 0.0, "output": 0.0},
            "claude-3-5-sonnet-20240620": {"input": 0.003, "output": 0.015},
            "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
            "claude-3-haiku-20240307": {"input": 0.00025, "output": 0.00125},
        }
        
        print("=== 2. Update LLMModel Prices ===")
        updated_models = 0
        models = db.query(LLMModel).all()
        model_map = {} # ID -> Model
        
        for model in models:
            # Clean ID (strip models/ prefix)
            clean_id = model.model_id_for_api_call.replace("models/", "")
            
            if clean_id in KNOWN_PRICES:
                prices = KNOWN_PRICES[clean_id]
                changed = False
                
                if model.input_price_1k is None:
                    model.input_price_1k = prices["input"]
                    changed = True
                
                if model.output_price_1k is None:
                    model.output_price_1k = prices["output"]
                    changed = True
                    
                if changed:
                    print(f" -> Updating price for {model.name} ({clean_id})")
                    updated_models += 1
            
            model_map[model.id] = model
            
        db.commit()
        print(f"Updated {updated_models} models.")

        print("=== 3. Recalculate Historical Usage Logs ===")
        # Find usage logs with 0 cost but have tokens
        usage_logs = db.query(LLMUsageLog).filter(
            LLMUsageLog.total_cost == 0,
            (LLMUsageLog.prompt_tokens > 0) | (LLMUsageLog.completion_tokens > 0)
        ).all()
        
        updated_logs = 0
        affected_run_ids = set()
        
        for log in usage_logs:
            if log.model_id and log.model_id in model_map:
                model = model_map[log.model_id]
                if model.input_price_1k is not None:
                    # Calculate
                    input_cost = (log.prompt_tokens / 1000.0) * float(model.input_price_1k)
                    output_cost = (log.completion_tokens / 1000.0) * float(model.output_price_1k)
                    total = input_cost + output_cost
                    
                    if total > 0:
                        log.total_cost = total
                        updated_logs += 1
                        if log.workflow_run_id:
                            affected_run_ids.add(log.workflow_run_id)
        
        db.commit()
        print(f"Recalculated cost for {updated_logs} usage logs.")
        
        print("=== 4. Aggregate Workflow Run Costs ===")
        # Re-aggregate specific affected runs
        updated_runs = 0
        for run_id in affected_run_ids:
            run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
            if run:
                # Sum from usage logs
                result = db.execute(
                    text("SELECT SUM(total_cost), SUM(prompt_tokens + completion_tokens) FROM llm_usage_logs WHERE workflow_run_id = :run_id"),
                    {"run_id": run_id}
                ).fetchone()
                
                cost_sum = result[0] or 0.0
                token_sum = result[1] or 0
                
                run.total_cost = cost_sum
                run.total_tokens = token_sum
                updated_runs += 1
                
        db.commit()
        print(f"Updated aggregations for {updated_runs} workflow runs.")
        print("Done.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_prices()
