# GitHub Project Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GitHub repository page clearer, more professional, and more persuasive for users who want a Windows desktop app for Pi without terminal-heavy setup.

**Architecture:** Keep the change documentation-focused. Update the README as the primary public landing page, verify the GitHub Release assets are present, and improve repository metadata through GitHub CLI.

**Tech Stack:** Markdown, GitHub Releases, GitHub repository metadata, existing Electron/React/TypeScript project.

---

### Task 1: Rewrite Public README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the README with a product-oriented landing page**

Create sections for positioning, download links, who it is for, feature highlights, first-run setup, privacy, troubleshooting, development, release verification, and license.

- [ ] **Step 2: Keep claims accurate**

Only mention Windows binaries, GitHub Releases, provider/API key setup, optional Git workflows, local workspace access, and current file preview support.

### Task 2: Verify Release Completeness

**Files:**
- Read only: GitHub Release `v0.2.1`

- [ ] **Step 1: Query release assets**

Run:

```powershell
gh release view v0.2.1 --json tagName,name,url,isDraft,isPrerelease,assets
```

Expected: Release is not draft, not prerelease, and includes setup exe, portable exe, blockmap, and latest.yml.

### Task 3: Improve Repository Metadata

**Files:**
- Remote metadata only

- [ ] **Step 1: Update repository description and topics**

Run `gh repo edit` with a concise product description and relevant topics such as `electron`, `desktop-app`, `ai-agent`, `windows`, `typescript`, and `react`.

### Task 4: Verify, Commit, And Push

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/plans/2026-06-12-github-project-page-polish.md`

- [ ] **Step 1: Check Markdown content**

Review the README locally and ensure there are no broken local file references or unsupported claims.

- [ ] **Step 2: Commit and push**

Run:

```powershell
git add README.md docs/superpowers/plans/2026-06-12-github-project-page-polish.md
git commit -m "Polish GitHub project page"
git push origin codex/preview-session-robustness
```
