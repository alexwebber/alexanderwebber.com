"""The CLI wiring (contracts/pipeline.md exit codes)."""

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


def test_missing_only_needs_a_reimport_window(capsys):
    assert cli.main(["fetch", "--archive", "local", "--missing-only"]) == 2


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


# --- Fundraising ---

CAMPAIGN = (
    "- { id: alpha, race_id: alpha, charity: { name: Example }, "
    "page_url: https://www.justgiving.com/page/example-alpha }\n"
)


@pytest.fixture
def fundraising(repo, tmp_path):
    (repo / "data/running/owner/campaigns.yaml").write_text(CAMPAIGN)
    return ["--archive", "local", "--archive-dir", str(tmp_path / "a"), "--repo-root", str(repo)]


def one_line(capsys) -> dict:
    out = capsys.readouterr().out.splitlines()
    assert len(out) == 1
    return json.loads(out[0])


@pytest.fixture
def real_provider_on_fake_api(monkeypatch, justgiving_api, justgiving_key):
    class OnFakeApi(cli.JustGivingProvider):
        def __init__(self) -> None:
            super().__init__(transport=justgiving_api)

    monkeypatch.setattr(cli, "JustGivingProvider", OnFakeApi)
    return justgiving_api


def test_fundraising_read_and_publish_are_wired(
    fundraising, repo, capsys, real_provider_on_fake_api
):
    assert cli.main(["fundraising-read", *fundraising]) == 0
    summary = one_line(capsys)
    assert (summary["outcome"], summary["read"], summary["changed"]) == ("ok", 1, 1)
    assert cli.main(["fundraising-publish", *fundraising]) == 0
    assert one_line(capsys) == {
        "campaigns": 1,
        "code": None,
        "exit_code": 0,
        "outcome": "ok",
        "written": 1,
    }
    assert (repo / "data/running/published/fundraising/alpha.json").is_file()
    assert cli.main(["publish-check", "--repo-root", str(repo)]) == 0


def test_fundraising_read_with_no_key_exits_10_and_is_recorded(
    fundraising, tmp_path, monkeypatch, capsys
):
    monkeypatch.delenv("JUSTGIVING_SUBSCRIPTION_KEY", raising=False)
    assert cli.main(["fundraising-read", *fundraising]) == 10
    summary = one_line(capsys)
    assert (summary["outcome"], summary["code"]) == ("failed", "justgiving_key_rejected")
    state = json.loads((tmp_path / "a/state/fundraising.json").read_text())
    assert state["alpha"]["code"] == "justgiving_key_rejected"


@pytest.mark.parametrize(
    ("status", "headers", "code"),
    [
        (401, {}, 10),
        (403, {"retry-after": "3600"}, 11),
        (403, {}, 12),
        (418, {}, 13),
        (404, {}, 15),
    ],
)
def test_fundraising_read_exits_with_the_failures_code(
    fundraising, capsys, real_provider_on_fake_api, status, headers, code
):
    real_provider_on_fake_api.respond(status, b"{}", headers)
    assert cli.main(["fundraising-read", *fundraising]) == code


def test_fundraising_read_while_backing_off_exits_11(
    fundraising, capsys, real_provider_on_fake_api
):
    real_provider_on_fake_api.respond(429, b"{}", {"retry-after": "3600"})
    assert cli.main(["fundraising-read", *fundraising]) == 11
    capsys.readouterr()
    assert cli.main(["fundraising-read", *fundraising]) == 11
    assert one_line(capsys)["backing_off"] == 1
    assert len(real_provider_on_fake_api.requests) == 1


@pytest.mark.parametrize(
    "command", ["fundraising-read", "fundraising-publish", "fundraising-alert"]
)
def test_an_invalid_campaigns_file_exits_20_naming_file_entry_and_field(
    fundraising, repo, capsys, monkeypatch, command
):
    monkeypatch.setenv("GITHUB_TOKEN", "x")
    monkeypatch.setenv("GITHUB_REPOSITORY", "owner/repo")
    (repo / "data/running/owner/campaigns.yaml").write_text(
        "- { id: alpha, race_id: alpha, charity: { name: E }, page_url: http://example.org/ }\n"
    )
    assert cli.main([command, *fundraising]) == 20
    captured = capsys.readouterr()
    assert json.loads(captured.out)["code"] == "owner_data_invalid"
    assert 'data/running/owner/campaigns.yaml \\"alpha\\" field page_url' in captured.err


@pytest.mark.parametrize(
    "command", ["fundraising-read", "fundraising-publish", "fundraising-alert"]
)
def test_fundraising_commands_need_r2_settings(monkeypatch, repo, capsys, command):
    for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"):
        monkeypatch.delenv(name, raising=False)
    assert cli.main([command, "--archive", "r2", "--repo-root", str(repo)]) == 14
    assert json.loads(capsys.readouterr().out)["code"] == "archive_unavailable"


def test_fundraising_alert_needs_a_github_token(
    fundraising, capsys, monkeypatch, real_provider_on_fake_api
):
    assert cli.main(["fundraising-read", *fundraising]) == 0
    capsys.readouterr()
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    assert cli.main(["fundraising-alert", *fundraising]) == 1
    assert one_line(capsys)["code"] == "github_unavailable"


def test_no_fundraising_command_constructs_the_intervals_provider(
    fundraising, capsys, monkeypatch, real_provider_on_fake_api
):
    def refuse(*args, **kwargs):
        raise AssertionError("constructed IntervalsProvider")

    monkeypatch.setattr(cli.IntervalsProvider, "__init__", refuse)
    assert cli.main(["fundraising-read", *fundraising]) == 0
    assert cli.main(["fundraising-publish", *fundraising]) == 0


def test_fundraising_logs_name_the_provider(fundraising, capsys, real_provider_on_fake_api):
    cli.main(["fundraising-read", *fundraising])
    lines = [json.loads(line) for line in capsys.readouterr().err.splitlines()]
    assert lines and all(line["provider"] == "justgiving" for line in lines)
