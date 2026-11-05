---
name: speckit-house-process-tips-share-images
description: 'Agent tips for share images rendered with satori: content-box sizing, and checking a rendered PNG. Read before changing Open Graph or share image layouts.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.tips-share-images.md
---

# Agent tips: Share images (satori)

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **satori sizes boxes content-box.** A root with `width: 100%` plus padding and a border
  overflowed the canvas. Give the sized root no padding or border, put the padding on a
  `flexGrow: 1` child, and look at a rendered PNG before trusting a layout.