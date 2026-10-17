"""Command-line entry point. Subcommands arrive with the pipeline tasks (contracts/pipeline.md)."""

import sys


def main() -> int:
    print("awingest: no subcommands yet", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
