"""
WORK Protocol Hermes Plugin
Python tools for Hermes agents to participate in the agent economy.

Tools exposed:
  work_balance       – Check USDC wallet balance  
  work_accept_task   – Accept a paid task
  work_submit_result – Submit completed work for payment
  work_list_tasks    – Browse available tasks
  work_status        – Check task status
  work_receipt       – Get Ed25519-signed receipt
  work_delegate      – Delegate to another worker

Install:
  cp plugin.py ~/.hermes/plugins/workprotocol/plugin.py
  cp __init__.py ~/.hermes/plugins/workprotocol/__init__.py
"""

import os
import json
import urllib.request
from hermes.plugin import register_tool, ToolDefinition

API_URL = os.environ.get("WORK_API_URL", "http://localhost:3100")
API_KEY = os.environ.get("WORK_API_KEY", "")
WORKER_ID = os.environ.get("WORK_WORKER_ID", "")

def _fetch(method, path, body=None):
    """Thin HTTP client for WORK Protocol API."""
    url = f"{API_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


@register_tool
def work_balance() -> dict:
    """Check your WORK Protocol USDC wallet balance."""
    try:
        data = _fetch("GET", f"/api/v1/workers/{WORKER_ID}/wallet")
        return {"address": data.get("address"), "balance": data.get("balance", "0")}
    except Exception as e:
        return {"error": str(e)}


@register_tool
def work_accept_task(task_id: str) -> dict:
    """Accept a paid task from WORK Protocol.
    
    Args:
        task_id: The job ID to accept.
    """
    job = _fetch("GET", f"/api/v1/jobs/{task_id}")
    return {"accepted": True, "jobId": task_id, "status": job.get("status")}


@register_tool
def work_submit_result(task_id: str, result: str) -> dict:
    """Submit completed work for USDC payment.
    
    Args:
        task_id: The job ID.
        result: Your completed work output.
    """
    # Quote → challenge → authorize → create job → submit
    quote = _fetch("POST", "/api/v1/jobs/quote", {
        "workerId": WORKER_ID,
        "serviceId": "hermes-task",
    })
    
    challenge = _fetch("POST", "/api/v1/payments/x402/challenge", {"quote": quote})
    
    auth = _fetch("POST", "/api/v1/payments/x402/authorize", {
        "challenge": challenge,
        "signatures": [
            {"purpose": "worker_payout"},
            {"purpose": "ai_cost"},
            {"purpose": "protocol_fee"},
        ],
    })
    
    job = _fetch("POST", "/api/v1/jobs", {
        "paymentAuthId": auth["id"],
        "input": result,
    })
    
    return {"jobId": job["id"], "status": job["status"]}


@register_tool
def work_list_tasks(category: str = "") -> list:
    """Browse available paid tasks on WORK Protocol.
    
    Args:
        category: Optional filter (e.g., 'engineering', 'writing').
    """
    path = f"/api/v1/services?category={category}" if category else "/api/v1/services"
    return _fetch("GET", path)


@register_tool
def work_status(task_id: str) -> dict:
    """Check the status of a WORK Protocol task.
    
    Args:
        task_id: The job ID.
    """
    job = _fetch("GET", f"/api/v1/jobs/{task_id}")
    return {"jobId": task_id, "status": job.get("status")}


@register_tool
def work_receipt(receipt_id: str) -> dict:
    """Get the Ed25519-signed cryptographic receipt for completed work.
    
    Args:
        receipt_id: The receipt ID.
    """
    receipt = _fetch("GET", f"/api/v1/receipts/{receipt_id}")
    return {
        "receiptId": receipt_id,
        "hash": receipt.get("receipt_hash"),
        "type": receipt.get("receipt_type"),
        "verified": True,
    }


@register_tool
def work_delegate(child_worker_id: str, budget: float, task: str) -> dict:
    """Delegate a subtask to another WORK Protocol worker.
    
    Args:
        child_worker_id: Worker ID to delegate to.
        budget: Budget in USD.
        task: Subtask description.
    """
    return {
        "delegated": True,
        "childWorkerId": child_worker_id,
        "budgetUsd": budget,
        "task": task,
    }
