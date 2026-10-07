"""Check deployed HTTP delivery, API data, CORS and an optional isolated test account."""

import argparse
import json
import re
import secrets
import time
from http.client import HTTPException
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from uuid import uuid4


def validate_url(value, *, api=False, allow_local_http=False):
    url = urlparse(value)
    local = allow_local_http and url.hostname in {"localhost", "127.0.0.1"}
    if (
        not url.netloc
        or (url.scheme != "https" and not (local and url.scheme == "http"))
        or url.username
        or url.password
        or url.query
        or url.fragment
        or url.path.rstrip("/") != ("/api" if api else "")
    ):
        raise ValueError(
            "Use HTTPS origins and a backend URL ending in /api, without credentials."
        )
    return value.rstrip("/")


def send(url, *, method="GET", data=None, headers=None, timeout=120):
    body = json.dumps(data).encode() if data is not None else None
    request_headers = {"Content-Type": "application/json"} if body else {}
    request_headers.update(headers or {})
    try:
        with urlopen(
            Request(url, data=body, headers=request_headers, method=method),
            timeout=timeout,
        ) as response:
            content = response.read()
            return content, response.headers
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code} at {urlparse(url).path}") from None


def wait_for_ready(api):
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        try:
            content, _ = send(api + "/health/ready", timeout=5)
            if json.loads(content).get("status") == "ok":
                return
        except (RuntimeError, OSError, HTTPException, ValueError):
            pass
        time.sleep(2)
    raise RuntimeError("API readiness did not succeed within three minutes")


def run(frontend, api, *, account_check=False):
    wait_for_ready(api)
    checks = []
    for path in ("/", "/sources", "/explore", "/compare", "/workspace"):
        content, headers = send(frontend + path)
        html = content.decode()
        assert 'id="root"' in html and "text/html" in headers.get("Content-Type", ""), (
            path
        )
        assets = re.findall(r'(?:src|href)="(/assets/[^" ]+)"', html)
        assert assets, "Frontend must serve the production bundle"
        for asset in assets:
            bundle, asset_headers = send(frontend + asset)
            assert bundle and "text/html" not in asset_headers.get(
                "Content-Type", ""
            ), asset
    checks.append("Frontend routes and production assets")

    def api_request(path, data=None, *, method=None, token=None):
        content, _ = send(
            api + path,
            method=method or ("POST" if data is not None else "GET"),
            data=data,
            headers={"Authorization": "Bearer " + token} if token else None,
        )
        return json.loads(content) if content else None

    for path in ("/health", "/health/ready"):
        assert api_request(path)["status"] == "ok"
    _, headers = send(
        api + "/auth/login",
        method="OPTIONS",
        headers={
            "Origin": frontend,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert headers.get("Access-Control-Allow-Origin") == frontend
    assert "POST" in headers.get("Access-Control-Allow-Methods", "")
    checks.append("API health/readiness and frontend CORS")

    catalog = api_request("/colleges/catalog")
    courses = {
        course["id"]: course for college in catalog for course in college["courses"]
    }
    manifest = json.loads(
        (
            Path(__file__).parents[1] / "backend/seed/data/reviewed_directory_2026.json"
        ).read_text()
    )
    assert len(catalog) == 19 and len(courses) == 57
    for reviewed in manifest["courses"]:
        course = courses[reviewed["courseId"]]
        for fact in reviewed["facts"]:
            evidence = course[fact["kind"] + "Evidence"]
            assert (
                evidence["rawValue"] == fact["rawValue"]
                and evidence["rawUnit"] == fact["rawUnit"]
            )
            assert evidence["documentSha256"] == fact["source"]["documentSha256"]
            assert evidence["source"]["status"] == "verified"
    assert all(college["dataStatus"] == "demo" for college in catalog)
    filtered = api_request("/colleges?degree=B.A.&limit=50")
    assert filtered["total"] == 3
    first, second = catalog[:2]
    options = [
        {"collegeId": college["id"], "courseId": college["courses"][0]["id"]}
        for college in (first, second)
    ]
    assert api_request("/compare", {"options": options})
    checks.append("Demo catalog, reviewed evidence, discovery and comparison")

    if account_check:
        account = {
            "name": "Deployment Smoke Test",
            "email": f"deploy-smoke-{uuid4().hex}@example.com",
            "password": secrets.token_urlsafe(32),
        }
        token = api_request("/auth/register", account)["access_token"]
        assert api_request("/auth/me", token=token)["name"] == account["name"]
        entry = api_request(
            "/workspace",
            {**options[0], "notes": "Disposable deployment smoke entry"},
            token=token,
        )
        entry_id = entry["id"]
        entry = api_request(
            "/workspace/" + entry_id,
            {
                "revision": entry["revision"],
                "stage": "Shortlisted",
                "nextAction": "Disposable deployment smoke check",
            },
            method="PATCH",
            token=token,
        )
        fresh_token = api_request(
            "/auth/login", {"email": account["email"], "password": account["password"]}
        )["access_token"]
        saved = api_request("/workspace", token=fresh_token)
        assert (
            len(saved) == 1
            and saved[0]["id"] == entry_id
            and saved[0]["stage"] == "Shortlisted"
        )
        api_request(
            f"/workspace/{entry_id}?revision={entry['revision']}",
            method="DELETE",
            token=fresh_token,
        )
        assert api_request("/workspace", token=fresh_token) == []
        checks.append(
            "Isolated registration/login and persisted workspace create/edit/delete"
        )
        checks.append("A labelled smoke-test account remains; its entry was removed")
    return {
        "checks": checks,
        "colleges": len(catalog),
        "courses": len(courses),
        "reviewedCourses": len(manifest["courses"]),
        "visualBrowserCheck": "separate",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frontend-url", required=True)
    parser.add_argument("--api-url", required=True)
    parser.add_argument(
        "--account-check",
        action="store_true",
        help="Create one labelled test account and exercise its disposable workspace entry",
    )
    parser.add_argument(
        "--allow-local-http",
        action="store_true",
        help="Allow HTTP on localhost/127.0.0.1 for rehearsal",
    )
    args = parser.parse_args()
    try:
        frontend = validate_url(
            args.frontend_url, allow_local_http=args.allow_local_http
        )
        api = validate_url(
            args.api_url, api=True, allow_local_http=args.allow_local_http
        )
        print(
            json.dumps(run(frontend, api, account_check=args.account_check), indent=2)
        )
    except (
        AssertionError,
        ValueError,
        RuntimeError,
        URLError,
        OSError,
        HTTPException,
    ) as error:
        raise SystemExit("Deployment check failed: " + str(error)) from None
