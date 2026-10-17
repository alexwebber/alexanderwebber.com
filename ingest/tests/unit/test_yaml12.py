import pytest
from yaml.constructor import ConstructorError

from awingest import yaml12


def test_reads_owner_values_as_the_site_does():
    doc = yaml12.load(
        "time: 3:30:00\nshort: 44:59\ndate: 2027-04-04\nn: 010\nflag: no\non: yes\n"
        "t: true\nx: 0x1f\nf: 17.5\nnothing: ~\n"
    )
    assert doc == {
        "time": "3:30:00",
        "short": "44:59",
        "date": "2027-04-04",
        "n": 10,
        "flag": "no",
        "on": "yes",
        "t": True,
        "x": 31,
        "f": 17.5,
        "nothing": None,
    }


def test_rejects_duplicate_keys():
    with pytest.raises(ConstructorError, match="duplicate key 'id'"):
        yaml12.load("- id: a\n  id: b\n")
