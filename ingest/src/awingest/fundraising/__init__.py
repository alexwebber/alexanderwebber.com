"""Fundraising's stages (specs/002-fundraising/contracts/pipeline.md): read, publish and alert.
They share no state or exit paths with Running's, so a failure on one side can't reach the other
(FR-003)."""
