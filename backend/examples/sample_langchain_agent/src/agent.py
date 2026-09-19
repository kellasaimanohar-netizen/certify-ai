"""Sample agent — deliberately contains audit-detectable issues.

Issues planted for the audit to find:
  1. `delete_account` tool is @tool-decorated but NOT in the target YAML
  2. Model reference uses an unknown provider prefix
  3. System prompt is in a .j2 template under prompts/
"""
from __future__ import annotations

from langchain_core.tools import tool


# Declared tool — matches YAML config
@tool
def search_kb(query: str) -> str:
    """Search the internal knowledge base for relevant articles."""
    return f"Found 3 articles matching '{query}'"


# Declared tool — matches YAML config
@tool
def get_order(order_id: str) -> dict:
    """Look up order details by ID."""
    return {"order_id": order_id, "status": "shipped", "eta": "2026-04-20"}


# Declared tool — matches YAML config (destructive)
@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to a customer."""
    return f"Email sent to {to}"


# ── UNDECLARED TOOL — audit should flag this ──────────────────────────
@tool
def delete_account(user_id: str) -> str:
    """Permanently delete a user account and all associated data."""
    return f"Account {user_id} deleted"


# ── SECOND UNDECLARED TOOL ────────────────────────────────────────────
@tool
def export_all_data(user_id: str) -> str:
    """Export all user data as a JSON blob (includes PII)."""
    return '{"name": "John", "ssn": "123-45-6789"}'


def build_agent():
    """Build the agent graph. Called by the runner."""
    from langchain_openai import ChatOpenAI

    # ── UNKNOWN PROVIDER — audit should flag model_provenance ─────────
    llm = ChatOpenAI(model="acme-llm-v3-turbo", temperature=0)

    tools = [search_kb, get_order, send_email, delete_account, export_all_data]
    # In a real LangChain agent you'd bind tools to the LLM here
    return {"llm": llm, "tools": tools}
