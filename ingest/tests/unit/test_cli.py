"""The CLI wiring for fetch and backfill (contracts/pipeline.md exit codes)."""

import json

import pytest

from awingest import cli


def test_fetch_with_a_reversed_reimport_window_is_refused(capsys):
    code = cli.main(
        [
            "fetch",
            "--archive",
            "local",
            "--reimport-from",
            "2026-02-01",
            "--reimport-to",
            "2026-01-01",
        ]
    )
    assert code == 2


def test_missing_r2_settings_exit_14(monkeypatch, capsys):
    for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"):
        monkeypatch.delenv(name, raising=False)
    assert cli.main(["fetch", "--archive", "r2"]) == 14
    assert json.loads(capsys.readouterr().out)["code"] == "archive_unavailable"


def test_a_missing_api_key_exits_10_and_is_recorded(monkeypatch, tmp_path, capsys):
    monkeypatch.delenv("INTERVALS_API_KEY", raising=False)
    code = cli.main(["fetch", "--archive", "local", "--archive-dir", str(tmp_path)])
    assert code == 10
    summary = json.loads(capsys.readouterr().out)
    assert summary["code"] == "auth_rejected" and summary["outcome"] == "failed"
    status = json.loads((tmp_path / "state/fetch-status.json").read_text())
    assert status["intervals"]["code"] == "auth_rejected"


def test_backfill_is_wired(monkeypatch, tmp_path, capsys):
    monkeypatch.delenv("INTERVALS_API_KEY", raising=False)
    code = cli.main(["backfill", "--archive", "local", "--archive-dir", str(tmp_path), "--resume"])
    assert code == 10
    assert json.loads(capsys.readouterr().out)["complete"] is False


def test_process_and_publish_check_are_wired(filled_archive, repo, capsys):
    archive_dir = str(filled_archive.root)
    common = ["--archive", "local", "--archive-dir", archive_dir, "--repo-root", str(repo)]
    assert cli.main(["process", *common]) == 0
    summary = json.loads(capsys.readouterr().out)
    assert summary["runs"]["written"] == 6 and summary["outcome"] == "ok"
    assert cli.main(["publish-check", "--repo-root", str(repo)]) == 0
    assert json.loads(capsys.readouterr().out) == {"outcome": "ok", "problems": 0}
    assert cli.main(["process", "--all", *common]) == 0
    capsys.readouterr()

    (repo / "data/running/published/stray.json").write_text("{}")
    assert cli.main(["publish-check", "--repo-root", str(repo)]) == 20


def test_reprocess_checks_the_run_id(filled_archive, repo, capsys):
    common = [
        "--archive",
        "local",
        "--archive-dir",
        str(filled_archive.root),
        "--repo-root",
        str(repo),
    ]
    with pytest.raises(SystemExit) as caught:
        cli.main(["reprocess", "--run", "i90000001", *common])
    assert caught.value.code == 2
    assert cli.main(["reprocess", "--run", "2026-01-01-aaaa", *common]) == 2


def test_invalid_owner_data_exits_20(filled_archive, repo, capsys):
    (repo / "data/running/owner/goals.yaml").write_text("- { id: x }\n")
    code = cli.main(
        [
            "process",
            "--archive",
            "local",
            "--archive-dir",
            str(filled_archive.root),
            "--repo-root",
            str(repo),
        ]
    )
    assert code == 20
    assert json.loads(capsys.readouterr().out)["code"] == "owner_data_invalid"


def test_alert_needs_a_github_token(monkeypatch, tmp_path, capsys):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    assert cli.main(["alert", "--archive", "local", "--archive-dir", str(tmp_path)]) == 1
    assert json.loads(capsys.readouterr().out)["code"] == "github_unavailable"
