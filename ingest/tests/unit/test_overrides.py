"""Owner inputs for the processor (T061): validated with YAML 1.2 rules, and hashed per run."""

from datetime import date

import pytest

from awingest.process.overrides import OwnerDataInvalid, RunOverride, load_owner
from awingest.schemas import SchemaSet

RUN = "2026-10-11-k3f7"


@pytest.fixture
def owner(repo):
    return repo / "data/running/owner"


@pytest.fixture
def schemas(repo):
    return SchemaSet(repo / "schemas")


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_no_owner_files_means_no_overrides(owner, schemas):
    inputs = load_owner(owner, schemas)
    assert inputs.override(RUN) == RunOverride()
    assert inputs.races == {} and inputs.exclusions == frozenset()
    assert inputs.goal_distances == ()


def test_everything_the_processor_reads(owner, schemas):
    write(
        owner / "run-overrides.yaml",
        f"- {{ id: {RUN}, title: Long run with Sam, hide: false, include_in_records: true }}\n",
    )
    write(owner / "health-exclusions.yaml", "- { metric: weight_kg, date: 2026-09-14 }\n")
    write(
        owner / "goals.yaml",
        "- { id: sub-45, type: race_time, title: 10k sub-45, priority: 1, featured: true,"
        ' target: { distance: 10k, time: "44:59" } }\n'
        "- { id: eight, type: race_time, title: 8 km, priority: 2, featured: false,"
        ' target: { distance_m: 8000, time: "36:00" } }\n',
    )
    write(
        owner / "races/hastings-half-2026/race.yaml",
        f"slug: hastings-half-2026\nrun_id: {RUN}\nname: Hastings Half\ndate: 2026-10-11\n"
        "distance: half\ndesignate: race\nhide_map: true\n",
    )
    write(
        owner / "races/old-10k/race.yaml",
        'slug: old-10k\ndate: 2019-10-13\ndistance: 10k\nofficial_time: "52:30"\n',
    )
    inputs = load_owner(owner, schemas)
    assert inputs.override(RUN) == RunOverride(title="Long run with Sam", include_in_records=True)
    assert inputs.exclusions == {("weight_kg", date(2026, 9, 14))}
    assert inputs.goal_distances == (8000, 10000)
    race = inputs.races[RUN]
    assert (race.slug, race.name, race.designate, race.hide_map) == (
        "hastings-half-2026",
        "Hastings Half",
        "race",
        True,
    )
    assert list(inputs.races) == [RUN]  # the hand-entered race touches no run


def test_errors_name_the_file_entry_and_field(owner, schemas):
    write(owner / "run-overrides.yaml", f"- {{ id: {RUN}, titel: typo }}\n")
    write(
        owner / "goals.yaml",
        "- { id: sub-45, type: race_time, title: x, priority: 1, featured: true,"
        ' target: { distance: 10k, time: "44:7x" } }\n',
    )
    with pytest.raises(OwnerDataInvalid) as caught:
        load_owner(owner, schemas)
    problems = caught.value.problems
    assert any(p.startswith(f'data/running/owner/run-overrides.yaml "{RUN}"') for p in problems)
    assert any(
        p.startswith('data/running/owner/goals.yaml "sub-45" field target/time:')
        and "not a valid time" in p
        for p in problems
    )
    assert caught.value.exit_code == 20


def test_owner_yaml_is_read_as_yaml_1_2(owner, schemas):
    # Under YAML 1.1, 44:59 is the integer 2699 and fails the schema as a non-string.
    write(
        owner / "goals.yaml",
        "- { id: g, type: race_time, title: x, priority: 1, featured: true,"
        " target: { distance: 5k, time: 19:59 } }\n",
    )
    assert load_owner(owner, schemas).goal_distances == (5000,)


def test_duplicates_that_would_make_processing_ambiguous_are_errors(owner, schemas):
    write(
        owner / "run-overrides.yaml", f"- {{ id: {RUN}, hide: true }}\n- {{ id: {RUN}, note: x }}\n"
    )
    for slug in ("a", "b"):
        write(
            owner / f"races/{slug}/race.yaml",
            f"slug: {slug}\nrun_id: {RUN}\ndate: 2026-10-11\ndistance: 5k\n",
        )
    with pytest.raises(OwnerDataInvalid) as caught:
        load_owner(owner, schemas)
    assert len(caught.value.problems) == 2


def test_the_run_hash_changes_only_with_what_affects_the_run(owner, schemas):
    other = "2026-10-12-abcd"
    write(owner / "run-overrides.yaml", f"- {{ id: {RUN}, note: one }}\n")
    before = load_owner(owner, schemas)
    write(owner / "run-overrides.yaml", f"- {{ id: {RUN}, note: two }}\n")
    after = load_owner(owner, schemas)
    assert before.run_hash(RUN) != after.run_hash(RUN)
    assert before.run_hash(other) == after.run_hash(other)
    write(
        owner / "goals.yaml",
        "- { id: g, type: race_time, title: x, priority: 1, featured: true,"
        ' target: { distance: 8000, time: "36:00" } }\n',
    )
    # A new goal distance adds a best effort to every run.
    assert load_owner(owner, schemas).run_hash(other) != after.run_hash(other)


def test_invalid_yaml_is_reported(owner, schemas):
    write(owner / "run-overrides.yaml", "- { id: [unclosed\n")
    with pytest.raises(OwnerDataInvalid, match="not valid YAML"):
        load_owner(owner, schemas)
