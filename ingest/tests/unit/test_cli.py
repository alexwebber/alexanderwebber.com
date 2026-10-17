"""The CLI wiring for fetch and backfill (contracts/pipeline.md exit codes)."""

import json

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
