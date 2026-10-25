import re

from fastapi.testclient import TestClient

from auth import current_user
from main import app
from tests.conftest import make_pdf

FOLDER = "11111111-1111-1111-1111-111111111111"


def roadmap(title="Graphs", extra=None, refs=None):
    nodes = [
        {"key": "bfs", "title": "BFS", "description": "Queue-based traversal.", "parentKey": None, "sourceRefs": refs or []},
        {"key": "dfs", "title": "DFS", "description": "Stack-based traversal.", "parentKey": None, "sourceRefs": []},
        {"key": "scc", "title": "Tarjan's algorithm", "description": "SCCs with low-link.", "parentKey": "dfs", "sourceRefs": refs or []},
    ] + (extra or [])
    return {"title": title, "nodes": nodes}


def assert_default_timers(nodes):
    assert nodes
    for n in nodes:
        assert n["totalSeconds"] == 1800 and n["remainingSeconds"] == 1800, n
        assert n["status"] == "idle"


def gen(client, prompt="Teach me graphs", files=None, **data):
    return client.post("/api/mindmap/generate", data={"prompt": prompt, **data}, files=files or [])


# ------------------------------------------------------------------ engine 2: pure LLM


def test_prompt_only_generation_is_ungrounded_and_uses_30_minute_timers(client, ai, store):
    ai.queue.append(roadmap())
    r = gen(client)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["grounded"] is False and body["sources"] == []
    assert_default_timers(body["nodes"])
    ids = {n["id"] for n in body["nodes"]}
    assert len(ids) == 3
    by_title = {n["title"]: n for n in body["nodes"]}
    assert by_title["Tarjan's algorithm"]["parentId"] == by_title["DFS"]["id"]
    assert by_title["BFS"]["parentId"] is None
    assert "SOURCES" not in ai.calls[0]["user"]
    assert store.inserted == [] and store.match_calls == []  # no knowledge touched


def test_llm_output_is_repaired_cycles_unknown_parents_depth_and_size(client, ai):
    chain = [
        {"key": f"c{i}", "title": f"Deep {i}", "description": "", "parentKey": (f"c{i-1}" if i else None), "sourceRefs": []}
        for i in range(6)
    ]
    junk = [
        {"key": "a", "title": "Cycle A", "description": "", "parentKey": "b", "sourceRefs": []},
        {"key": "b", "title": "Cycle B", "description": "", "parentKey": "a", "sourceRefs": []},
        {"key": "o", "title": "Orphan", "description": "", "parentKey": "ghost", "sourceRefs": [9]},
        {"key": "o", "title": "Duplicate key", "description": "", "parentKey": None, "sourceRefs": []},
        {"key": "blank", "title": "   ", "description": "", "parentKey": None, "sourceRefs": []},
    ] + [{"key": f"x{i}", "title": f"Filler {i}", "description": "", "parentKey": None, "sourceRefs": []} for i in range(30)]
    ai.queue.append({"title": "Messy", "nodes": chain + junk})
    nodes = gen(client).json()["nodes"]
    assert len(nodes) == 20
    assert_default_timers(nodes)
    by_id = {n["id"]: n for n in nodes}

    def depth(n):
        d = 1
        while n["parentId"]:
            n = by_id[n["parentId"]]
            d += 1
            assert d < 50, "cycle survived"
        return d

    assert max(depth(n) for n in nodes) <= 3
    assert all(n["parentId"] in by_id or n["parentId"] is None for n in nodes)
    titles = [n["title"] for n in nodes]
    assert "Duplicate key" not in titles and titles.count("Orphan") == 1
    assert next(n for n in nodes if n["title"] == "Orphan")["sources"] == []  # ref 9 doesn't exist


def test_folder_notes_are_searched_when_no_files(client, ai, store):
    store.match_rows = [{"source_title": "notes.md", "page_number": 4, "content": "Kosaraju uses two DFS passes.", "similarity": 0.8}]
    ai.queue.append(roadmap(refs=[1]))
    body = gen(client, folderId=FOLDER).json()
    assert body["grounded"] is True
    assert body["sources"] == [{"title": "notes.md", "pages": [4]}]
    assert store.match_calls[0]["folder"] == FOLDER and store.match_calls[0]["user"] == "user-1"
    assert "Kosaraju uses two DFS passes." in ai.calls[0]["user"]
    assert "notes.md p.4" in next(n for n in body["nodes"] if n["title"] == "BFS")["sources"]


def test_empty_folder_falls_back_to_prompt_only_with_a_warning(client, ai, store):
    ai.queue.append(roadmap())
    body = gen(client, folderId=FOLDER).json()
    assert body["grounded"] is False
    assert any("Nothing in that folder" in w for w in body["warnings"])


# ------------------------------------------------------------------ engine 1: PDF RAG


def test_pdf_upload_is_chunked_embedded_saved_and_grounds_the_roadmap(client, ai, store):
    from config import settings

    settings.rag_top_k = 1
    pdf = make_pdf([
        "Pasta recipes. Boil water, add salt, cook the spaghetti for nine minutes and serve with basil.",
        "Tarjan low-link values. Tarjan's algorithm finds strongly connected components using low-link values and a stack in one depth first pass.",
    ])
    ai.queue.append(roadmap(refs=[1]))
    r = gen(client, "Teach me Tarjan low-link values", files=[("files", ("graphs.pdf", pdf, "application/pdf"))], folderId=FOLDER)
    assert r.status_code == 200, r.text
    body = r.json()

    assert body["grounded"] is True
    assert body["sources"] == [{"title": "graphs.pdf", "pages": [2]}]
    prompt = ai.calls[0]["user"]
    assert "low-link" in prompt and "spaghetti" not in prompt  # only the relevant chunk reached the LLM
    assert any("graphs.pdf p.2" in n["sources"] for n in body["nodes"])
    assert_default_timers(body["nodes"])

    assert len(store.inserted) == 2  # both pages were saved for future retrieval
    row = store.inserted[1]
    assert row["source_title"] == "graphs.pdf" and row["page_number"] == 2 and row["folder_id"] == FOLDER
    assert len(row["embedding"]) == 768
    assert "user_id" not in row  # identity comes from the JWT/RLS, never from the client or this code


def test_pdf_persist_failure_still_returns_a_roadmap_with_a_warning(client, ai, store):
    store.fail_insert = True
    ai.queue.append(roadmap(refs=[1]))
    pdf = make_pdf(["Dijkstra's algorithm uses a priority queue to find shortest paths in weighted graphs with no negative edges."])
    r = gen(client, files=[("files", ("sp.pdf", pdf, "application/pdf"))])
    assert r.status_code == 200
    body = r.json()
    assert body["grounded"] is True and any("weren't saved" in w for w in body["warnings"])


def test_long_pdf_pages_are_split_into_overlapping_chunks(client, ai, store):
    sentence = "Breadth first search explores the graph level by level using a queue. "
    pdf = make_pdf([sentence * 60])  # ~4000 chars on one page
    ai.queue.append(roadmap())
    assert gen(client, files=[("files", ("bfs.pdf", pdf, "application/pdf"))]).status_code == 200
    assert 3 <= len(store.inserted) <= 6
    assert all(len(r["content"]) <= 1250 for r in store.inserted)
    assert {r["page_number"] for r in store.inserted} == {1}


# ------------------------------------------------------------------ upload validation


def test_non_pdf_is_rejected(client):
    r = gen(client, files=[("files", ("notes.pdf", b"just text", "application/pdf"))])
    assert r.status_code == 400 and "isn't a PDF" in r.json()["detail"]


def test_scanned_pdf_without_text_gets_a_clear_error(client):
    r = gen(client, files=[("files", ("scan.pdf", make_pdf([""]), "application/pdf"))])
    assert r.status_code == 400 and "no selectable text" in r.json()["detail"]


def test_oversize_and_too_many_files(client):
    from config import settings

    pdf = make_pdf(["Some text that is long enough to be a real chunk of content for the test."])
    settings.max_pdf_mb = 0
    assert gen(client, files=[("files", ("a.pdf", pdf, "application/pdf"))]).status_code == 413
    settings.max_pdf_mb = 15
    settings.max_files = 1
    two = [("files", ("a.pdf", pdf, "application/pdf")), ("files", ("b.pdf", pdf, "application/pdf"))]
    assert gen(client, files=two).status_code == 400


def test_bad_folder_id_and_short_prompt(client):
    assert gen(client, folderId="not-a-uuid").status_code == 422
    assert gen(client, prompt="hi").status_code == 422


def test_auth_is_required():
    app.dependency_overrides.pop(current_user, None)
    c = TestClient(app)
    assert c.post("/api/mindmap/generate", data={"prompt": "graphs please"}).status_code == 401
    assert c.post("/api/mindmap/command", json={"command": "hi", "nodes": []}).status_code == 401
    assert c.post("/api/mindmap/command", json={"command": "hi", "nodes": []}, headers={"Authorization": "Basic x"}).status_code == 401


# ------------------------------------------------------------------ /command


NODES = [
    {"id": "n_bfs", "title": "BFS", "status": "idle", "remainingSeconds": 1800, "totalSeconds": 1800, "parentId": None},
    {"id": "n_dij", "title": "Dijkstra", "status": "running", "remainingSeconds": 600, "totalSeconds": 1800, "parentId": None},
    {"id": "n_tar", "title": "Tarjan's algorithm", "status": "idle", "remainingSeconds": 1800, "totalSeconds": 1800, "parentId": None},
]


def cmd(client, text, **extra):
    return client.post("/api/mindmap/command", json={"command": text, "nodes": NODES, "mapTitle": "Graphs", **extra})


def decision(action, target=None, seconds=None, prompt=None, reply="Done."):
    return {"action": action, "targetNodeId": target, "seconds": seconds, "prompt": prompt, "reply": reply}


def test_complete(client, ai):
    ai.queue.append(decision("COMPLETE", "n_tar", reply="Tarjan marked complete."))
    r = cmd(client, "Tarjan completed")
    assert r.status_code == 200 and r.json()["action"] == "COMPLETE" and r.json()["targetNodeId"] == "n_tar"
    assert "n_dij" in ai.calls[0]["user"] and "Tarjan completed" in ai.calls[0]["user"]  # model sees live node states


def test_add_time_and_clamping(client, ai):
    ai.queue.append(decision("ADD_TIME", "n_dij", seconds=3600))
    assert cmd(client, "Add 1hr to Dijkstra").json()["seconds"] == 3600
    ai.queue.append(decision("ADD_TIME", "n_dij", seconds=5))
    assert cmd(client, "add 5 seconds to Dijkstra").json()["seconds"] == 60
    ai.queue.append(decision("ADD_TIME", "n_dij", seconds=10**9))
    assert cmd(client, "add forever to Dijkstra").json()["seconds"] == 8 * 3600


def test_add_time_without_amount_asks_for_one(client, ai):
    ai.queue.append(decision("ADD_TIME", "n_dij", seconds=None))
    r = cmd(client, "add time to Dijkstra")
    assert r.status_code == 422 and "How much time" in r.json()["detail"]


def test_restart_recovers_from_a_hallucinated_node_id_by_title(client, ai):
    ai.queue.append(decision("RESTART", "n_does_not_exist"))
    r = cmd(client, "restart tarzan")  # speech-to-text misspelling of Tarjan
    assert r.status_code == 200 and r.json()["targetNodeId"] == "n_tar"


def test_unresolvable_target_is_a_clear_error(client, ai):
    ai.queue.append(decision("COMPLETE", "n_nope"))
    r = cmd(client, "finish the thing")
    assert r.status_code == 422 and "which topic" in r.json()["detail"]


def test_expand_creates_30_minute_children_under_the_target_without_duplicates(client, ai):
    kids = [
        {"key": k, "title": t, "description": "d", "parentKey": None, "sourceRefs": []}
        for k, t in [("a", "Low-link values"), ("b", "The stack invariant"), ("c", "Bridges"), ("d", "bfs")]  # 'bfs' is not a child of Tarjan
    ] + [{"key": "e", "title": "Low-link values", "description": "dup", "parentKey": None, "sourceRefs": []}]
    ai.queue += [decision("EXPAND", "n_tar"), {"title": "x", "nodes": kids}]
    r = cmd(client, "expand Tarjan")
    assert r.status_code == 200
    body = r.json()
    new = body["newNodes"]
    assert_default_timers(new)
    assert all(n["parentId"] == "n_tar" for n in new)
    assert [n["title"] for n in new] == ["Low-link values", "The stack invariant", "Bridges", "bfs"]
    assert len({n["id"] for n in new} | {n["id"] for n in NODES}) == 7  # fresh, non-colliding ids
    assert "Tarjan's algorithm" in ai.calls[1]["user"]


def test_expand_uses_folder_notes_when_a_folder_is_given(client, ai, store):
    store.match_rows = [{"source_title": "algo.pdf", "page_number": 9, "content": "Low-link is the smallest index reachable.", "similarity": 0.9}]
    kids = [{"key": "a", "title": "Low-link values", "description": "d", "parentKey": None, "sourceRefs": [1]}]
    ai.queue += [decision("EXPAND", "n_tar"), {"title": "x", "nodes": kids}]
    body = cmd(client, "go deeper on Tarjan", folderId=FOLDER).json()
    assert body["grounded"] is True and body["newNodes"][0]["sources"] == ["algo.pdf p.9"]
    assert "smallest index reachable" in ai.calls[1]["user"]


def test_generate_new_map_from_voice(client, ai):
    ai.queue += [decision("GENERATE_NEW_MAP", prompt="dynamic programming for interviews"), roadmap("Dynamic programming")]
    r = cmd(client, "make me a new map for dynamic programming for interviews")
    assert r.status_code == 200
    body = r.json()
    assert body["action"] == "GENERATE_NEW_MAP" and body["map"]["title"] == "Dynamic programming"
    assert_default_timers(body["map"]["nodes"])
    assert "dynamic programming for interviews" in ai.calls[1]["user"]
