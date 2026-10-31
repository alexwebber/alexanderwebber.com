"""``data/running/owner/campaigns.yaml`` (data-model §5), read with YAML 1.2 rules and validated
against its schema. A missing file means no campaigns. Cross-file checks are the gate's
``validate-data``."""

from dataclasses import dataclass
from pathlib import Path

from awingest.process.overrides import OwnerDataInvalid, read_owner_file
from awingest.process.pipeline import OWNER
from awingest.schemas import SchemaSet

CAMPAIGNS = OWNER / "campaigns.yaml"


@dataclass(frozen=True)
class Campaign:
    id: str
    race_id: str
    charity_name: str
    page_url: str
    finished: bool = False


def load_campaigns(repo_root: Path, schemas: SchemaSet) -> list[Campaign]:
    """In file order. Problems raise ``OwnerDataInvalid`` naming file, entry and field."""
    problems: list[str] = []
    value = read_owner_file(
        repo_root / CAMPAIGNS, "owner/campaigns", schemas, problems, CAMPAIGNS.as_posix()
    )
    if problems:
        raise OwnerDataInvalid(problems)
    return [
        Campaign(
            id=item["id"],
            race_id=item["race_id"],
            charity_name=item["charity"]["name"],
            page_url=item["page_url"],
            finished=item.get("finished", False),
        )
        for item in value or []
    ]
