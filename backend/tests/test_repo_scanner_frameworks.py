"""Repo scanner — framework decorator coverage.

Confirms the AST scanner discovers tool functions decorated with the newer
framework decorators (LlamaIndex, AutoGen) in addition to the original set
(LangChain, OpenAI SDK, CrewAI, MCP, generic).
"""
from __future__ import annotations

from agent_audit.sources.repo_adapter import RepoAdapter, _TOOL_DECORATORS

SAMPLE = '''
from llama_index.core.tools import FunctionTool
from autogen import register_for_llm, register_for_execution

@tool
def langchain_tool(x): return x

@FunctionTool
def llamaindex_tool(query): return query

@register_for_llm(description="add two numbers")
def autogen_llm_tool(a, b): return a + b

@register_for_execution()
def autogen_exec_tool(path): return open(path).read()

def not_a_tool(z): return z
'''


def test_new_framework_decorators_registered():
    # Guard the registry itself so the set can't silently regress.
    for dec in ("FunctionTool", "register_for_llm", "register_for_execution",
                "register_function", "fn",
                "kernel_function", "agent_tool", "component", "Tool", "tool_plain"):
        assert dec in _TOOL_DECORATORS


def test_scanner_discovers_llamaindex_and_autogen(tmp_path):
    (tmp_path / "agent.py").write_text(SAMPLE, encoding="utf-8")
    manifest = RepoAdapter().extract({"path": str(tmp_path)}, agent_name="t")
    names = {t.name for t in manifest.capabilities.tools}

    # LlamaIndex + AutoGen tools are picked up...
    assert "llamaindex_tool" in names
    assert "autogen_llm_tool" in names
    assert "autogen_exec_tool" in names
    # ...alongside the original LangChain one...
    assert "langchain_tool" in names
    # ...and a plain undecorated function is NOT treated as a tool.
    assert "not_a_tool" not in names


NEWER = '''
from semantic_kernel.functions import kernel_function
from haystack import component

@kernel_function(description="get weather")
def sk_weather(city): return city

@component
def haystack_node(docs): return docs

@agent.tool_plain
def pydantic_tool(q): return q

@agent.tool
def pydantic_ctx_tool(ctx, q): return q
'''


def test_scanner_discovers_newer_frameworks(tmp_path):
    (tmp_path / "a.py").write_text(NEWER, encoding="utf-8")
    manifest = RepoAdapter().extract({"path": str(tmp_path)}, agent_name="t")
    names = {t.name for t in manifest.capabilities.tools}
    assert "sk_weather" in names          # Semantic Kernel
    assert "haystack_node" in names       # Haystack
    assert "pydantic_tool" in names       # PydanticAI tool_plain
    assert "pydantic_ctx_tool" in names   # PydanticAI @agent.tool (name 'tool')
