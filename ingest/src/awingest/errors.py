"""The base of every failure the pipeline reports (contracts/pipeline.md, alert contract).

Each failure class carries a stable ``code`` for logs and alerts, the CLI exit code, and the
``likely_cause`` and ``action`` text that the alert issue quotes. Provider failures live in
``providers/base.py`` and archive failures in ``archive/base.py``; both subclass this.
"""


class IngestError(Exception):
    """A classified pipeline failure. Subclasses set the class attributes."""

    code: str = "ingest_error"
    exit_code: int = 1
    likely_cause: str = "An unexpected error."
    action: str = "The agent inspects the run log."
