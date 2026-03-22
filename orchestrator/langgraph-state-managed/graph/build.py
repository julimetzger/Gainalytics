from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from orchestrator.graph.nodes import (
    NodeContext,
    finalize_node,
    load_task_node,
    reserve_slot_node,
    resolve_defaults_node,
    run_checks_node,
    run_codex_node,
    validate_task_node,
    wait_for_human_answer_node,
    write_human_question_node,
)
from orchestrator.models.enums import TaskStatus


class GraphState(TypedDict, total=False):
    run_id: str
    task_id: str
    task_file: str
    status: str
    slot_id: str | None
    worktree_path: str | None
    emulator_serial: str | None
    resolved_policy_file: str | None
    codex_log_file: str | None
    codex_exit_code: int | None
    changed_files: list[str]
    check_results: dict[str, Any]
    open_question_id: str | None
    human_answers: list[str]
    codex_attempts: int
    repair_attempts: int
    latest_check_feedback: str | None
    codex_summary: str | None
    error_message: str
    started_at: str
    updated_at: str
    raw_task: dict[str, Any]
    pending_question_reason: str | None
    pending_question: str | None


def _route_after_validate(state: GraphState) -> str:
    return "finalize_failed_validation" if state["status"] == TaskStatus.FAILED_VALIDATION.value else "resolve_defaults"


def _route_after_reserve_slot(state: GraphState) -> str:
    return "finalize_failed_env" if state["status"] == TaskStatus.FAILED_ENV.value else "run_codex"


def _route_after_codex(state: GraphState) -> str:
    if state["status"] == TaskStatus.WAITING_HUMAN.value:
        return "write_human_question"
    if state["status"] == TaskStatus.RUNNING_CHECKS.value:
        return "run_checks"
    if state["status"] == TaskStatus.FAILED_CODE.value:
        return "finalize_failed_code"
    return "finalize_failed_env"


def _route_after_wait(state: GraphState) -> str:
    if state["status"] == TaskStatus.RUNNING_CODEX.value:
        return "run_codex"
    return "finalize_failed_env"


def _route_after_checks(state: GraphState) -> str:
    if state["status"] == TaskStatus.RUNNING_CODEX.value:
        return "run_codex"
    if state["status"] == TaskStatus.SUCCEEDED.value:
        return "finalize_success"
    if state["status"] == TaskStatus.FAILED_CODE.value:
        return "finalize_failed_code"
    return "finalize_failed_env"


def build_graph(context: NodeContext):
    graph = StateGraph(GraphState)

    graph.add_node("load_task", lambda state: load_task_node(context, state))
    graph.add_node("validate_task", lambda state: validate_task_node(context, state))
    graph.add_node("resolve_defaults", lambda state: resolve_defaults_node(context, state))
    graph.add_node("reserve_slot", lambda state: reserve_slot_node(context, state))
    graph.add_node("run_codex", lambda state: run_codex_node(context, state))
    graph.add_node("write_human_question", lambda state: write_human_question_node(context, state))
    graph.add_node("wait_for_human_answer", lambda state: wait_for_human_answer_node(context, state))
    graph.add_node("run_checks", lambda state: run_checks_node(context, state))

    graph.add_node("finalize_success", lambda state: finalize_node(context, state))
    graph.add_node("finalize_failed_code", lambda state: finalize_node(context, state))
    graph.add_node("finalize_failed_env", lambda state: finalize_node(context, state))
    graph.add_node("finalize_failed_validation", lambda state: finalize_node(context, state))

    graph.set_entry_point("load_task")
    graph.add_edge("load_task", "validate_task")
    graph.add_conditional_edges(
        "validate_task",
        _route_after_validate,
        {
            "resolve_defaults": "resolve_defaults",
            "finalize_failed_validation": "finalize_failed_validation",
        },
    )
    graph.add_edge("resolve_defaults", "reserve_slot")
    graph.add_conditional_edges(
        "reserve_slot",
        _route_after_reserve_slot,
        {
            "run_codex": "run_codex",
            "finalize_failed_env": "finalize_failed_env",
        },
    )
    graph.add_conditional_edges(
        "run_codex",
        _route_after_codex,
        {
            "write_human_question": "write_human_question",
            "run_checks": "run_checks",
            "finalize_failed_code": "finalize_failed_code",
            "finalize_failed_env": "finalize_failed_env",
        },
    )
    graph.add_edge("write_human_question", "wait_for_human_answer")
    graph.add_conditional_edges(
        "wait_for_human_answer",
        _route_after_wait,
        {
            "run_codex": "run_codex",
            "finalize_failed_env": "finalize_failed_env",
        },
    )
    graph.add_conditional_edges(
        "run_checks",
        _route_after_checks,
        {
            "run_codex": "run_codex",
            "finalize_success": "finalize_success",
            "finalize_failed_code": "finalize_failed_code",
            "finalize_failed_env": "finalize_failed_env",
        },
    )

    graph.add_edge("finalize_success", END)
    graph.add_edge("finalize_failed_code", END)
    graph.add_edge("finalize_failed_env", END)
    graph.add_edge("finalize_failed_validation", END)

    return graph.compile()
