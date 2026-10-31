"""The fundraising read and publish stages, rule by rule on a fixed clock (data-model §2-§4;
specs/002-fundraising/contracts/pipeline.md)."""

import io
import json
from datetime import UTC, datetime, timedelta

import pytest

from awingest.archive.base import ArchiveUnavailable
from awingest.archive.local import LocalArchive
from awingest.fetch import run_fetch
from awingest.fundraising.campaigns import load_campaigns
from awingest.fundraising.publish import run_fundraising_publish
from awingest.fundraising.read import published_path, run_fundraising_read
from awingest.logging import Logger
from awingest.process.overrides import OwnerDataInvalid
from awingest.process.pipeline import PUBLISHED
from awingest.providers.base import AuthRejected, FundraisingSnapshot, RateLimited, Transient
from awingest.providers.justgiving.errors import PageNotFound, QuotaExhausted
from awingest.publish.manifest import check_published
from awingest.schemas import SchemaSet
from awingest.state import FETCH_STATUS, FRESHNESS, FUNDRAISING_FRESHNESS, FUNDRAISING_STATE

NOW = datetime(2026, 11, 10, 9, 17, 3, tzinfo=UTC)
STAMP = "2026-11-10T09:17:03Z"
EARLIER = "2026-11-10T07:17:00Z"
PAGE = "https://www.justgiving.com/page/example-{}"
ONE = "- {{ id: {0}, race_id: {0}, charity: {{ name: Example }}, page_url: {1}{2} }}\n"


def snapshot(raised=12500, target=50000, supporters=3, status="Active") -> FundraisingSnapshot:
    return FundraisingSnapshot(raised, target, supporters, status)


class FakeProvider:
    """Serves a snapshot or raises, per page. Records each call."""

    name = "fake"

    def __init__(self, default=None, **by_campaign) -> None:
        self.default = default if default is not None else snapshot()
        self.by_campaign = by_campaign
        self.calls: list[str] = []

    def read_page(self, page_url: str) -> FundraisingSnapshot:
        self.calls.append(page_url)
        answer = self.by_campaign.get(page_url.rsplit("example-", 1)[1], self.default)
        if isinstance(answer, Exception):
            raise answer
        return answer


def log(stream=None) -> Logger:
    return Logger("fundraising-read", provider="fake", stream=stream or io.StringIO())


def write_campaigns(repo, *ids, finished=()):
    text = "".join(
        ONE.format(c, PAGE.format(c), ", finished: true" if c in finished else "") for c in ids
    )
    (repo / "data/running/owner/campaigns.yaml").write_text(text, encoding="utf-8")


def write_published(repo, campaign="alpha", last_read_at=EARLIER, points=None):
    path = published_path(repo, campaign)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = {
        "schema_version": 1,
        "campaign_id": campaign,
        "last_read_at": last_read_at,
        "points": points
        or [{"date": "2026-11-09", "raised_pence": 12500, "target_pence": 50000, "supporters": 3}],
    }
    path.write_text(json.dumps(doc), encoding="utf-8")
    return doc


def published(repo, campaign="alpha"):
    return json.loads(published_path(repo, campaign).read_text(encoding="utf-8"))


def read_state(archive, key=FUNDRAISING_STATE):
    data = archive.get(key)
    return None if data is None else json.loads(data)


def put_state(archive, **entries):
    archive.put(FUNDRAISING_STATE, json.dumps(entries).encode())


@pytest.fixture
def archive(tmp_path) -> LocalArchive:
    return LocalArchive(tmp_path / "archive")


@pytest.fixture
def alpha(repo):
    write_campaigns(repo, "alpha")
    return repo


def read(provider, archive, repo, now=NOW, sleep=lambda s: None, stream=None):
    return run_fundraising_read(
        provider, archive, repo_root=repo, log=log(stream), now=now, sleep=sleep
    )


def publish(archive, repo, now=NOW):
    return run_fundraising_publish(archive, repo_root=repo, log=log(), now=now)


# --- Campaigns ---


def test_a_missing_campaigns_file_means_no_campaigns(repo):
    assert load_campaigns(repo, SchemaSet(repo / "schemas")) == []


def test_an_invalid_campaigns_file_names_file_entry_and_field(repo):
    (repo / "data/running/owner/campaigns.yaml").write_text(
        "- id: alpha\n  race_id: alpha\n  charity: { name: Example }\n"
        "  page_url: https://www.justgiving.com/page/example-alpha\n  target: 500\n"
    )
    with pytest.raises(OwnerDataInvalid) as caught:
        load_campaigns(repo, SchemaSet(repo / "schemas"))
    message = str(caught.value)
    assert 'data/running/owner/campaigns.yaml "alpha" field target:' in message
    assert "JustGiving" in message


# --- Read: one rule at a time ---


def test_same_figures_move_the_live_time_with_no_change(alpha, archive):
    write_published(alpha)
    result = read(FakeProvider(), archive, alpha)
    assert (result.outcome, result.read, result.changed, result.exit_code) == ("ok", 1, 0, 0)
    entry = read_state(archive)["alpha"]
    assert entry["outcome"] == "ok" and entry["last_success_at"] == STAMP
    assert "first_unpublished_at" not in entry


def test_same_figures_clear_the_unpublished_mark(alpha, archive):
    write_published(alpha)
    put_state(archive, alpha={"first_unpublished_at": EARLIER, "consecutive_failures": 0})
    read(FakeProvider(), archive, alpha)
    assert "first_unpublished_at" not in read_state(archive)["alpha"]


def test_different_figures_update_latest_and_hold_the_live_time(alpha, archive):
    write_published(alpha)
    put_state(archive, alpha={"last_success_at": EARLIER, "consecutive_failures": 0})
    result = read(FakeProvider(snapshot(raised=15000, supporters=4)), archive, alpha)
    assert (result.changed, result.read) == (1, 1)
    entry = read_state(archive)["alpha"]
    assert entry["outcome"] == "unpublished"
    assert entry["last_success_at"] == EARLIER
    assert entry["first_unpublished_at"] == STAMP
    assert entry["latest"] == {
        "read_at": STAMP,
        "raised_pence": 15000,
        "target_pence": 50000,
        "supporters": 4,
    }


def test_a_target_change_alone_is_a_change(alpha, archive):
    write_published(alpha)
    assert read(FakeProvider(snapshot(target=60000)), archive, alpha).changed == 1


def test_a_page_losing_its_target_is_a_change(alpha, archive):
    write_published(alpha)
    assert read(FakeProvider(snapshot(target=None)), archive, alpha).changed == 1


def test_the_live_time_takes_the_published_files_time_if_later(alpha, archive):
    # A busy day: each publish moves last_read_at, and the read carries it forward (research R6).
    write_published(alpha, last_read_at="2026-11-10T08:00:00Z")
    put_state(archive, alpha={"last_success_at": EARLIER, "consecutive_failures": 0})
    read(FakeProvider(snapshot(raised=15000)), archive, alpha)
    assert read_state(archive)["alpha"]["last_success_at"] == "2026-11-10T08:00:00Z"


def test_a_first_read_with_no_file_is_a_change_with_no_live_time(alpha, archive):
    result = read(FakeProvider(), archive, alpha)
    assert (result.outcome, result.read, result.changed) == ("ok", 1, 1)
    entry = read_state(archive)["alpha"]
    assert entry["outcome"] == "unpublished" and entry["first_unpublished_at"] == STAMP
    assert "last_success_at" not in entry
    assert read_state(archive, FUNDRAISING_FRESHNESS) == {"campaigns": {}, "generated_at": STAMP}


def test_the_first_unpublished_time_is_kept_across_reads(alpha, archive):
    read(FakeProvider(), archive, alpha)
    read(FakeProvider(), archive, alpha, now=NOW + timedelta(hours=2))
    assert read_state(archive)["alpha"]["first_unpublished_at"] == STAMP


def test_a_failed_read_changes_no_figure(alpha, archive):
    before = write_published(alpha)
    read(FakeProvider(), archive, alpha, now=NOW - timedelta(hours=2))
    good = read_state(archive)["alpha"]
    result = read(FakeProvider(Transient("network error")), archive, alpha)
    assert (result.outcome, result.failed, result.code, result.exit_code) == (
        "failed",
        1,
        "transient",
        1,
    )
    entry = read_state(archive)["alpha"]
    assert entry["latest"] == good["latest"]
    assert entry["last_success_at"] == good["last_success_at"]
    assert (entry["outcome"], entry["code"], entry["consecutive_failures"]) == (
        "failed",
        "transient",
        1,
    )
    assert published(alpha) == before


def test_a_success_after_a_failure_clears_it(alpha, archive):
    write_published(alpha)
    read(FakeProvider(Transient("network error")), archive, alpha, now=NOW - timedelta(hours=2))
    read(FakeProvider(), archive, alpha)
    entry = read_state(archive)["alpha"]
    assert entry["consecutive_failures"] == 0
    assert entry["code"] is None and entry["error_class"] is None and entry["message"] is None


def test_all_zeros_over_real_figures_is_suspect(alpha, archive):
    before = write_published(alpha)
    result = read(FakeProvider(snapshot(raised=0, supporters=0)), archive, alpha)
    assert (result.code, result.exit_code, result.read, result.failed) == (
        "suspect_figures",
        13,
        0,
        1,
    )
    entry = read_state(archive)["alpha"]
    assert entry["code"] == "suspect_figures" and "latest" not in entry
    assert published(alpha) == before


def test_zeros_before_any_donation_are_not_suspect(alpha, archive):
    zero = snapshot(raised=0, supporters=0)
    point = {"date": "2026-11-09", "raised_pence": 0, "target_pence": 50000, "supporters": 0}
    write_published(alpha, points=[point])
    result = read(FakeProvider(zero), archive, alpha)
    assert (result.code, result.changed) == (None, 0)


def test_a_page_that_is_not_active_still_reads(alpha, archive):
    write_published(alpha)
    result = read(FakeProvider(snapshot(status="Expired")), archive, alpha)
    assert (result.outcome, result.exit_code) == ("ok", 0)
    assert read_state(archive)["alpha"]["page_status"] == "Expired"


def test_one_campaign_failing_does_not_stop_another(repo, archive):
    write_campaigns(repo, "alpha", "beta")
    write_published(repo, "beta")
    provider = FakeProvider(alpha=PageNotFound("404"))
    result = read(provider, archive, repo)
    assert (result.outcome, result.read, result.failed) == ("partial", 1, 1)
    assert (result.code, result.exit_code) == ("page_not_found", 15)
    state = read_state(archive)
    assert state["alpha"]["code"] == "page_not_found" and "latest" not in state["alpha"]
    assert state["beta"]["outcome"] == "ok"


def test_the_first_failure_gives_the_exit_code(repo, archive):
    write_campaigns(repo, "alpha", "beta")
    provider = FakeProvider(alpha=PageNotFound("404"), beta=AuthRejected("401"))
    assert read(provider, archive, repo).exit_code == 15


def test_campaigns_are_read_in_file_order_at_most_one_a_second(repo, archive):
    write_campaigns(repo, "beta", "alpha", "gamma")
    provider, sleeps = FakeProvider(), []
    read(provider, archive, repo, sleep=sleeps.append)
    assert provider.calls == [PAGE.format(c) for c in ("beta", "alpha", "gamma")]
    assert sleeps == [1.0, 1.0]


@pytest.mark.parametrize(
    ("error", "code"),
    [
        (RateLimited("429", retry_after=3600), "rate_limited"),
        (QuotaExhausted("403", retry_after=3600), "justgiving_quota"),
    ],
)
def test_a_limit_stops_calls_until_it_passes(alpha, archive, error, code):
    result = read(FakeProvider(error), archive, alpha)
    assert (result.code, result.exit_code) == (code, 11)
    assert read_state(archive)["alpha"]["rate_limited_until"] == "2026-11-10T10:17:03Z"

    provider = FakeProvider()
    result = read(provider, archive, alpha, now=NOW + timedelta(minutes=30))
    assert provider.calls == []
    assert (result.outcome, result.backing_off, result.read) == ("failed", 1, 0)
    assert (result.code, result.exit_code) == ("rate_limited", 11)

    result = read(provider, archive, alpha, now=NOW + timedelta(minutes=61))
    assert len(provider.calls) == 1 and result.exit_code == 0
    assert read_state(archive)["alpha"]["rate_limited_until"] is None


def test_a_backing_off_campaign_makes_the_run_partial(repo, archive):
    write_campaigns(repo, "alpha", "beta")
    put_state(
        archive,
        alpha={"rate_limited_until": "2026-11-10T10:00:00Z", "consecutive_failures": 1},
    )
    provider = FakeProvider()
    result = read(provider, archive, repo)
    assert provider.calls == [PAGE.format("beta")]
    assert (result.outcome, result.backing_off, result.read) == ("partial", 1, 1)


def test_no_campaigns_means_no_calls_and_no_writes(repo, archive):
    provider = FakeProvider()
    result = read(provider, archive, repo)
    assert (result.outcome, result.exit_code, result.campaigns) == ("ok", 0, 0)
    assert provider.calls == [] and archive.get(FUNDRAISING_STATE) is None


def test_a_finished_campaign_makes_no_call_and_leaves_the_freshness_file(repo, archive):
    write_campaigns(repo, "alpha", finished=("alpha",))
    put_state(archive, alpha={"last_success_at": EARLIER, "consecutive_failures": 0})
    provider = FakeProvider()
    result = read(provider, archive, repo)
    assert provider.calls == [] and result.exit_code == 0
    assert read_state(archive, FUNDRAISING_FRESHNESS)["campaigns"] == {}


def test_a_campaign_whose_race_has_passed_is_still_read(alpha, archive):
    # Nothing in the read looks at the race, so late donations keep arriving (FR-023, US4.2).
    (alpha / "data/running/owner/upcoming-races.yaml").write_text(
        "- { id: alpha, name: Past, date: 2020-01-01, distance: 10k }\n"
    )
    provider = FakeProvider()
    read(provider, archive, alpha)
    assert provider.calls == [PAGE.format("alpha")]


def test_corrupt_state_exits_14_and_leaves_running_alone(alpha, archive, provider):
    archive.put(FUNDRAISING_STATE, b"{not json")
    archive.put(FETCH_STATUS, b'{"intervals": {"outcome": "ok", "consecutive_failures": 0}}')
    before = archive.get(FETCH_STATUS)
    fake = FakeProvider()
    result = read(fake, archive, alpha)
    assert (result.outcome, result.code, result.exit_code) == ("failed", "archive_unavailable", 14)
    assert fake.calls == [] and archive.get(FETCH_STATUS) == before

    fetched = run_fetch(provider, archive, log=Logger("fetch", stream=io.StringIO()), now=NOW)
    assert fetched.exit_code == 0 and archive.get(FUNDRAISING_STATE) == b"{not json"


def test_a_failing_read_leaves_running_state_alone(alpha, archive):
    archive.put(FETCH_STATUS, b"{}")
    archive.put(FRESHNESS, b"{}")
    read(FakeProvider(AuthRejected("401")), archive, alpha)
    assert archive.get(FETCH_STATUS) == b"{}" and archive.get(FRESHNESS) == b"{}"


def test_a_failing_running_fetch_leaves_fundraising_alone(alpha, archive, provider, api):
    read(FakeProvider(), archive, alpha)
    state, freshness = archive.get(FUNDRAISING_STATE), archive.get(FUNDRAISING_FRESHNESS)
    api.fail("/activities", (401, {}, b"{}"), times=5)
    assert run_fetch(provider, archive, log=Logger("fetch", stream=io.StringIO()), now=NOW)
    assert archive.get(FUNDRAISING_STATE) == state
    assert archive.get(FUNDRAISING_FRESHNESS) == freshness


def test_an_unclassified_error_keeps_only_its_type(alpha, archive):
    result = read(FakeProvider(ValueError("quoting SENTINEL-value")), archive, alpha)
    assert (result.failed, result.exit_code) == (1, 1)
    assert "SENTINEL" not in json.dumps(read_state(archive))


def test_a_state_write_failure_exits_14(alpha, archive, monkeypatch):
    def refuse(*args, **kwargs):
        raise ArchiveUnavailable("no")

    monkeypatch.setattr(archive, "put", refuse)
    result = read(FakeProvider(), archive, alpha)
    assert (result.outcome, result.exit_code) == ("failed", 14)


def test_the_freshness_file_holds_only_active_campaigns_and_the_contracts_fields(repo, archive):
    write_campaigns(repo, "alpha", "beta", "gamma", finished=("gamma",))
    write_published(repo, "alpha")
    put_state(archive, gamma={"last_success_at": EARLIER, "consecutive_failures": 0})
    read(FakeProvider(), archive, repo)  # beta has no file, so no live time yet
    assert read_state(archive, FUNDRAISING_FRESHNESS) == {
        "campaigns": {"alpha": {"last_read_at": STAMP}},
        "generated_at": STAMP,
    }


def test_the_state_entry_has_the_data_models_fields(alpha, archive):
    write_published(alpha)
    read(FakeProvider(), archive, alpha)
    assert read_state(archive) == {
        "alpha": {
            "last_attempt_at": STAMP,
            "last_success_at": STAMP,
            "outcome": "ok",
            "error_class": None,
            "code": None,
            "message": None,
            "consecutive_failures": 0,
            "rate_limited_until": None,
            "page_status": "Active",
            "latest": {
                "read_at": STAMP,
                "raised_pence": 12500,
                "target_pence": 50000,
                "supporters": 3,
            },
        }
    }


def test_the_summary_and_logs_hold_counts_only(alpha, archive):
    write_published(alpha)
    stream = io.StringIO()
    result = read(
        FakeProvider(snapshot(raised=7654321, target=8765432, supporters=98765)),
        archive,
        alpha,
        stream=stream,
    )
    assert result.summary() == {
        "outcome": "ok",
        "campaigns": 1,
        "read": 1,
        "changed": 1,
        "failed": 0,
        "backing_off": 0,
        "code": None,
        "exit_code": 0,
    }
    for figure in ("7654321", "8765432", "98765"):
        assert figure not in stream.getvalue()


# --- Publish: data-model §4, one row at a time ---


def latest(raised=12500, target=50000, supporters=3, read_at=STAMP):
    return {
        "read_at": read_at,
        "raised_pence": raised,
        "target_pence": target,
        "supporters": supporters,
    }


def state_with(archive, **figures):
    put_state(archive, alpha={"latest": latest(**figures), "consecutive_failures": 0})


def test_no_file_creates_one_with_one_point(alpha, archive):
    state_with(archive)
    result = publish(archive, alpha)
    assert (result.outcome, result.written, result.exit_code) == ("ok", 1, 0)
    assert published(alpha) == {
        "schema_version": 1,
        "campaign_id": "alpha",
        "last_read_at": STAMP,
        "points": [
            {"date": "2026-11-10", "raised_pence": 12500, "target_pence": 50000, "supporters": 3}
        ],
    }


def test_a_read_not_after_last_read_at_changes_nothing(alpha, archive):
    before = write_published(alpha, last_read_at=STAMP)
    state_with(archive, raised=99900)
    assert publish(archive, alpha).written == 0
    assert published(alpha) == before


def test_different_figures_the_same_day_replace_that_point(alpha, archive):
    point = {"date": "2026-11-10", "raised_pence": 100, "target_pence": 50000, "supporters": 1}
    write_published(alpha, points=[point])
    state_with(archive, raised=15000, supporters=4)
    assert publish(archive, alpha).written == 1
    doc = published(alpha)
    assert doc["last_read_at"] == STAMP and len(doc["points"]) == 1
    assert doc["points"][0]["raised_pence"] == 15000 and doc["points"][0]["supporters"] == 4


def test_different_figures_a_later_day_append_a_point(alpha, archive):
    write_published(alpha)
    state_with(archive, raised=15000, supporters=4)
    publish(archive, alpha)
    doc = published(alpha)
    assert doc["last_read_at"] == STAMP
    assert [p["date"] for p in doc["points"]] == ["2026-11-09", "2026-11-10"]


@pytest.mark.parametrize(
    ("age", "moves"),
    [
        (timedelta(hours=6), True),
        (timedelta(hours=7), True),
        (timedelta(hours=5, minutes=59, seconds=59), False),
    ],
)
def test_same_figures_move_last_read_at_only_at_6_hours(alpha, archive, age, moves):
    committed = (NOW - age).isoformat().replace("+00:00", "Z")
    before = write_published(alpha, last_read_at=committed)
    state_with(archive)
    assert publish(archive, alpha).written == (1 if moves else 0)
    doc = published(alpha)
    assert doc["last_read_at"] == (STAMP if moves else committed)
    assert doc["points"] == before["points"]


def test_last_read_at_is_the_reads_time_never_the_clock(alpha, archive):
    write_published(alpha, last_read_at="2026-11-09T09:00:00Z")
    state_with(archive, read_at=EARLIER)  # the last good read, 2 h before the failed one
    publish(archive, alpha)
    assert published(alpha)["last_read_at"] == EARLIER


def test_a_total_that_goes_down_is_written_as_it_is(alpha, archive):
    write_published(alpha)
    state_with(archive, raised=10000, supporters=2)
    publish(archive, alpha)
    assert published(alpha)["points"][-1]["raised_pence"] == 10000


def test_a_target_change_alone_makes_a_point(alpha, archive):
    write_published(alpha)
    state_with(archive, target=60000)
    publish(archive, alpha)
    points = published(alpha)["points"]
    assert len(points) == 2 and points[-1]["target_pence"] == 60000


def test_the_date_is_the_london_day_around_midnight_in_bst(alpha, archive):
    late = "2026-06-30T23:30:00Z"  # 00:30 on 1 July in London
    state_with(archive, read_at=late)
    publish(archive, alpha, now=datetime(2026, 6, 30, 23, 31, tzinfo=UTC))
    assert published(alpha)["points"][0]["date"] == "2026-07-01"


def test_the_date_is_the_london_day_around_midnight_in_gmt(alpha, archive):
    state_with(archive, read_at="2026-12-31T23:30:00Z")
    publish(archive, alpha, now=datetime(2026, 12, 31, 23, 31, tzinfo=UTC))
    assert published(alpha)["points"][0]["date"] == "2026-12-31"


def test_one_point_a_day_over_several_reads(alpha, archive):
    for hour, raised in ((9, 1000), (11, 2000), (15, 3000)):
        stamp = f"2026-11-10T{hour:02}:00:00Z"
        state_with(archive, raised=raised, read_at=stamp)
        publish(archive, alpha, now=datetime(2026, 11, 10, hour, 1, tzinfo=UTC))
    points = published(alpha)["points"]
    assert len(points) == 1 and points[0]["raised_pence"] == 3000


def test_a_page_with_no_target_omits_it(alpha, archive):
    state_with(archive, target=None)
    publish(archive, alpha)
    assert "target_pence" not in published(alpha)["points"][0]


def test_a_finished_campaign_is_skipped(repo, archive):
    write_campaigns(repo, "alpha", finished=("alpha",))
    before = write_published(repo, last_read_at="2026-11-01T09:00:00Z")
    state_with(archive, raised=99900)
    result = publish(archive, repo)
    assert (result.campaigns, result.written) == (0, 0)
    assert published(repo) == before


def test_a_file_is_kept_when_its_campaign_leaves_the_list(repo, archive):
    write_campaigns(repo, "beta")
    before = write_published(repo, "alpha")
    state_with(archive, raised=99900)
    assert publish(archive, repo).written == 0
    assert published(repo, "alpha") == before


def test_a_campaign_with_no_latest_is_skipped(alpha, archive):
    put_state(archive, alpha={"consecutive_failures": 3, "outcome": "failed"})
    assert publish(archive, alpha).written == 0
    assert not published_path(alpha, "alpha").exists()


def test_all_or_nothing_on_an_invalid_document(repo, archive):
    write_campaigns(repo, "alpha", "beta")
    put_state(
        archive,
        alpha={"latest": latest()},
        beta={"latest": latest(raised=-5)},
    )
    result = publish(archive, repo)
    assert (result.outcome, result.code, result.exit_code) == ("failed", "publish_invalid", 20)
    assert not published_path(repo, "alpha").exists()


def test_a_published_file_that_fails_its_schema_stops_rather_than_replaces(alpha, archive):
    path = published_path(alpha, "alpha")
    path.parent.mkdir(parents=True)
    path.write_text('{"campaign_id": "alpha"}')
    state_with(archive)
    assert publish(archive, alpha).exit_code == 20
    assert json.loads(path.read_text()) == {"campaign_id": "alpha"}


def test_an_invalid_owner_file_exits_20(alpha, archive):
    (alpha / "data/running/owner/campaigns.yaml").write_text("- { id: alpha }\n")
    result = publish(archive, alpha)
    assert (result.code, result.exit_code) == ("owner_data_invalid", 20)


def test_an_unreadable_state_exits_14(alpha, archive):
    archive.put(FUNDRAISING_STATE, b"{not json")
    assert publish(archive, alpha).exit_code == 14


def test_a_state_entry_with_no_read_time_exits_14(alpha, archive):
    put_state(archive, alpha={"latest": {"raised_pence": 1}})
    assert publish(archive, alpha).exit_code == 14


def test_the_publish_stage_does_not_write_to_the_archive(alpha, archive):
    state_with(archive)
    before = {info.key: info.etag for info in archive.list()}
    publish(archive, alpha)
    assert {info.key: info.etag for info in archive.list()} == before


def test_publish_check_accepts_the_result(alpha, archive):
    state_with(archive)
    publish(archive, alpha)
    assert check_published(alpha / PUBLISHED, SchemaSet(alpha / "schemas")) == []


def test_publish_check_rejects_a_wrong_campaign_id(repo):
    write_published(repo, "alpha")
    doc = published(repo, "alpha") | {"campaign_id": "beta"}
    published_path(repo, "alpha").write_text(json.dumps(doc))
    assert check_published(repo / PUBLISHED, SchemaSet(repo / "schemas")) == [
        "fundraising/alpha.json: campaign_id doesn't match the file name"
    ]


@pytest.mark.parametrize("dates", [["2026-11-10", "2026-11-09"], ["2026-11-09", "2026-11-09"]])
def test_publish_check_rejects_unsorted_or_repeated_points(repo, dates):
    point = {"raised_pence": 1, "supporters": 1}
    write_published(repo, "alpha", points=[point | {"date": d} for d in dates])
    assert check_published(repo / PUBLISHED, SchemaSet(repo / "schemas")) == [
        "fundraising/alpha.json: points must be sorted, one per day"
    ]


def test_publish_check_passes_with_runs_absent(repo):
    write_published(repo, "alpha")
    assert check_published(repo / PUBLISHED, SchemaSet(repo / "schemas")) == []


# --- Read then publish: the idle case, and the privacy property ---


def test_a_changed_read_publishes_and_the_next_read_confirms_it(alpha, archive):
    provider = FakeProvider(snapshot(raised=15000))
    assert read(provider, archive, alpha).changed == 1
    publish(archive, alpha)
    later = NOW + timedelta(hours=2)
    result = read(provider, archive, alpha, now=later)
    assert result.changed == 0
    assert read_state(archive)["alpha"]["last_success_at"] == "2026-11-10T11:17:03Z"
    assert publish(archive, alpha, now=later).written == 0  # the idle case: no commit


def test_no_sentinel_reaches_state_freshness_published_or_logs(
    alpha, archive, justgiving, justgiving_api
):
    justgiving_api.serve("page-sentinels.json")
    stream = io.StringIO()
    result = run_fundraising_read(
        justgiving, archive, repo_root=alpha, log=log(stream), now=NOW, sleep=lambda s: None
    )
    assert result.read == 1
    publish(archive, alpha)
    write_published_again = read(FakeProvider(snapshot(3000, 50000, 2)), archive, alpha)
    assert write_published_again.read == 1

    stored = b"".join(archive.get(info.key) for info in archive.list()).decode()
    outputs = {
        "archive": stored,
        "published": published_path(alpha, "alpha").read_text(encoding="utf-8"),
        "logs": stream.getvalue(),
    }
    for where, text in outputs.items():
        assert "sentinel" not in text.lower(), where
    assert sorted(info.key for info in archive.list()) == [
        FUNDRAISING_FRESHNESS,
        FUNDRAISING_STATE,
    ]


def test_a_read_failure_logs_key_names_and_stores_no_value(
    alpha, archive, justgiving, justgiving_api
):
    bad = json.dumps({"grandTotalRaisedExcludingGiftAid": "SENTINEL-total", "owner": "SENTINEL-o"})
    justgiving_api.respond(200, bad.encode())
    stream = io.StringIO()
    run_fundraising_read(
        justgiving, archive, repo_root=alpha, log=log(stream), now=NOW, sleep=lambda s: None
    )
    entry = read_state(archive)["alpha"]
    assert entry["code"] == "justgiving_changed"
    assert "owner" in entry["message"]
    assert "SENTINEL" not in stream.getvalue() and "SENTINEL" not in json.dumps(entry)
