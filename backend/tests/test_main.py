from unittest.mock import AsyncMock, MagicMock, patch
from urllib import response

from fastapi.testclient import TestClient
from backend.main import app
import httpx
client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "RepoRadar API",
    }


from unittest.mock import AsyncMock, MagicMock, patch


def test_get_repository_success():
    github_data = {
        "name": "fastapi",
        "full_name": "tiangolo/fastapi",
        "description": "FastAPI framework",
        "html_url": "https://github.com/tiangolo/fastapi",
        "stargazers_count": 100,
        "forks_count": 20,
        "language": "Python",
        "default_branch": "master",
        "created_at": "2018-12-08T08:21:28Z",
        "updated_at": "2026-10-14T10:00:00Z",
    }

    github_response = MagicMock()
    github_response.status_code = 200
    github_response.json.return_value = github_data

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=github_response)

    with patch(
        "backend.main.httpx.AsyncClient",
        return_value=mock_client,
    ):
        response = client.post(
            "/api/repository",
            json={"url": "https://github.com/tiangolo/fastapi"},
        )

    assert response.status_code == 200

    result = response.json()
    assert result["name"] == "fastapi"
    assert result["full_name"] == "tiangolo/fastapi"
    assert result["language"] == "Python"
    assert result["stars"] == 100
    assert result["forks"] == 20

    mock_client.get.assert_awaited_once()
    
    

def test_get_repository_not_found():
    github_response = MagicMock()
    github_response.status_code = 404

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=github_response)

    with patch(
        "backend.main.httpx.AsyncClient",
        return_value=mock_client,
    ):
        response = client.post(
            "/api/repository",
            json={"url": "https://github.com/nonexistent/repo"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == (
        "Repository not found or not publicly accessible."
    )


def test_get_repository_connection_error():
    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(
        side_effect=httpx.ConnectError("Connection failed")
    )

    with patch(
        "backend.main.httpx.AsyncClient",
        return_value=mock_client,
    ):
        response = client.post(
            "/api/repository",
            json={"url": "https://github.com/tiangolo/fastapi"},
        )

    assert response.status_code == 502
    assert response.json()["detail"] == (
        "Could not connect to GitHub. Please try again."
    )


def test_get_repository_tree_success():
    repo_data = {
        "default_branch": "main"
    }

    tree_data = {
        "truncated": False,
        "tree": [
            {"path": "README.md", "type": "blob", "size": 1200},
            {"path": "app", "type": "tree"},
            {"path": "app/main.py", "type": "blob", "size": 800},
        ],
    }

    repo_response = MagicMock()
    repo_response.status_code = 200
    repo_response.json.return_value = repo_data

    tree_response = MagicMock()
    tree_response.status_code = 200
    tree_response.json.return_value = tree_data

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(
        side_effect=[repo_response, tree_response]
    )

    with patch(
        "backend.main.httpx.AsyncClient",
        return_value=mock_client,
    ):
        response = client.post(
            "/api/repository/tree",
            json={"url": "https://github.com/tiangolo/fastapi"},
        )

    assert response.status_code == 200

    result = response.json()
    assert result["repository"] == "tiangolo/fastapi"
    assert result["branch"] == "main"
    assert result["truncated"] is False
    assert result["total_items"] == 3
    assert result["items"][0]["path"] == "README.md"
    assert result["items"][2]["path"] == "app/main.py"

    assert mock_client.get.await_count == 2


def test_get_repository_tree_failure():
    repo_response = MagicMock()
    repo_response.status_code = 200
    repo_response.json.return_value = {
        "default_branch": "main"
    }

    tree_response = MagicMock()
    tree_response.status_code = 500

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(
        side_effect=[repo_response, tree_response]
    )

    with patch(
        "backend.main.httpx.AsyncClient",
        return_value=mock_client,
    ):
        response = client.post(
            "/api/repository/tree",
            json={"url": "https://github.com/tiangolo/fastapi"},
        )

    assert response.status_code == 502
    assert response.json()["detail"] == (
        "Could not retrieve repository file tree."
    )


def test_analyze_repository_success():
    # Mock GitHub repository metadata
    repo_response = MagicMock()
    repo_response.status_code = 200
    repo_response.json.return_value = {
        "full_name": "tiangolo/fastapi",
        "description": "A test API framework",
        "language": "Python",
        "stargazers_count": 100,
        "default_branch": "main",
    }

    # Mock GitHub file tree
    tree_response = MagicMock()
    tree_response.status_code = 200
    tree_response.json.return_value = {
        "tree": [
            {"path": "README.md", "type": "blob", "size": 100},
            {"path": "app.py", "type": "blob", "size": 200},
        ]
    }

    # Mock downloading README.md
    readme_response = MagicMock()
    readme_response.status_code = 200
    readme_response.text = "# FastAPI\nA sample Python API project."

    # Mock downloading app.py
    app_response = MagicMock()      
    app_response.status_code = 200
    app_response.text = "from fastapi import FastAPI\napp = FastAPI()"

    # Mock Gemini's successful response
    gemini_response = MagicMock()
    gemini_response.status_code = 200
    gemini_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "1. Project Overview\nA Python API project."}
                    ]
                }
            }
        ]
    }

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(
    side_effect=[
        repo_response,
        tree_response,
        readme_response,
        app_response,
    ]
    )
    mock_client.post = AsyncMock(return_value=gemini_response)

    with (
        patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}),
        patch("backend.main.httpx.AsyncClient", return_value=mock_client),
    ):
        response = client.post(
            "/api/repository/analyze",
            json={"url": "https://github.com/tiangolo/fastapi"},
        )

    assert response.status_code == 200

    result = response.json()
    assert result["repository"] == "tiangolo/fastapi"
    assert result["branch"] == "main"
    assert "README.md" in result["files_analyzed"]
    assert "Project Overview" in result["analysis"]

    # 3 GitHub GETs: metadata, tree, and README download
    assert mock_client.get.await_count == 4
    # Gemini should be called exactly once
    mock_client.post.assert_awaited_once()


def test_analyze_repository_missing_api_key():
    with patch.dict("os.environ", {}, clear=True):
        response = client.post(
            "/api/repository/analyze",
            json={"url": "https://github.com/tiangolo/fastapi"},
        )

    assert response.status_code == 503
    assert response.json()["detail"] == (
        "Gemini API key is not configured in backend/.env"
    )


def test_analyze_repository_no_readable_files():
    repo_response = MagicMock()
    repo_response.status_code = 200
    repo_response.json.return_value = {
        "full_name": "testuser/empty-repo",
        "default_branch": "main",
    }

    tree_response = MagicMock()
    tree_response.status_code = 200
    tree_response.json.return_value = {
        "tree": [
            {"path": "image.png", "type": "blob", "size": 100},
            {"path": "document.pdf", "type": "blob", "size": 200},
        ]
    }

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(
        side_effect=[repo_response, tree_response]
    )

    with (
        patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}),
        patch("backend.main.httpx.AsyncClient", return_value=mock_client),
    ):
        response = client.post(
            "/api/repository/analyze",
            json={"url": "https://github.com/testuser/empty-repo"},
        )

    assert response.status_code == 200

    data = response.json()
    assert data["analysis_source"] == "fallback"
    assert data["files_analyzed"] == []
    assert data["analysis"]
    mock_client.post.assert_not_called()

def test_analyze_repository_gemini_failure():
    repo_response = MagicMock()
    repo_response.status_code = 200
    repo_response.json.return_value = {
        "full_name": "testuser/test-repo",
        "default_branch": "main",
    }

    tree_response = MagicMock()
    tree_response.status_code = 200
    tree_response.json.return_value = {
        "tree": [
            {"path": "README.md", "type": "blob", "size": 100}
        ]
    }

    file_response = MagicMock()
    file_response.status_code = 200
    file_response.text = "# Test Repository"

    # Simulate Gemini returning HTTP 503 on every attempt.
    gemini_response = MagicMock()
    gemini_response.status_code = 503
    gemini_response.text = "Service unavailable"

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(
        side_effect=[repo_response, tree_response, file_response]
    )
    mock_client.post = AsyncMock(return_value=gemini_response)

    with (
        patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}),
        patch("backend.main.httpx.AsyncClient", return_value=mock_client),
        patch("backend.main.asyncio.sleep", new_callable=AsyncMock),
        patch("backend.main.random.uniform", return_value=0),
    ):
        response = client.post(
            "/api/repository/analyze",
            json={"url": "https://github.com/testuser/test-repo"},
        )

    assert response.status_code == 200

    data = response.json()
    assert data["analysis_source"] == "fallback"
    assert data["analysis"]
    assert mock_client.post.await_count == 3


def test_analyze_repository_network_error():
    repo_response = MagicMock()
    repo_response.status_code = 200
    repo_response.json.return_value = {
        "full_name": "testuser/test-repo",
        "default_branch": "main",
    }

    tree_response = MagicMock()
    tree_response.status_code = 200
    tree_response.json.return_value = {
        "tree": [
            {"path": "README.md", "type": "blob", "size": 100}
        ]
    }

    file_response = MagicMock()
    file_response.status_code = 200
    file_response.text = "# Test Repository"

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_client.get = AsyncMock(
        side_effect=[repo_response, tree_response, file_response]
    )

    # Simulate a network failure when calling Gemini.
    mock_client.post = AsyncMock(
        side_effect=httpx.ConnectError("Simulated network failure")
    )

    with (
        patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}),
        patch("backend.main.httpx.AsyncClient", return_value=mock_client),
        patch("backend.main.asyncio.sleep", new_callable=AsyncMock),
        patch("backend.main.random.uniform", return_value=0),
    ):
        response = client.post(
            "/api/repository/analyze",
            json={"url": "https://github.com/testuser/test-repo"},
        )

    assert response.status_code == 200

    data = response.json()
    assert data["analysis_source"] == "fallback"
    assert data["analysis"]
    assert mock_client.post.await_count == 3


def test_analyze_repository_unexpected_ai_response():
    repo_response = MagicMock()
    repo_response.status_code = 200
    repo_response.json.return_value = {
        "full_name": "testuser/test-repo",
        "default_branch": "main",
    }

    tree_response = MagicMock()
    tree_response.status_code = 200
    tree_response.json.return_value = {
        "tree": [
            {"path": "README.md", "type": "blob", "size": 100}
        ]
    }

    file_response = MagicMock()
    file_response.status_code = 200
    file_response.text = "# Test Repository"

    gemini_response = MagicMock()
    gemini_response.status_code = 200
    gemini_response.json.return_value = {
        "unexpected_field": "unexpected response"
    }

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(
        side_effect=[repo_response, tree_response, file_response]
    )
    mock_client.post = AsyncMock(return_value=gemini_response)

    with (
        patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}),
        patch("backend.main.httpx.AsyncClient", return_value=mock_client),
    ):
        response = client.post(
            "/api/repository/analyze",
            json={"url": "https://github.com/testuser/test-repo"},
        )

    assert response.status_code == 200

    data = response.json()
    assert data["analysis_source"] == "fallback"
    assert data["analysis"]
    assert "repository" in data
