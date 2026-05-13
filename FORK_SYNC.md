# Fork Sync Guide

This fork (`botnick/mcp-chrome`) is based on `hangwin/mcp-chrome` with these customizations:

- All docs and source code translated to English
- Glassmorphism design system (`styles/glass/`, `components/glass/`)
- Windows installer (`scripts/quick-install.ps1`)
- Display mode toggle (Popup / Side Panel)
- `glass-light` and `glass-dark` theme presets

## Upstream Remote

```bash
git remote add upstream https://github.com/hangwin/mcp-chrome.git
```

## Sync Workflow

### 1. Fetch upstream

```bash
git fetch upstream
```

### 2. Merge with ours strategy for translations

Since upstream writes Chinese and we translate to English, use file-level merge with manual resolution:

```bash
git merge upstream/master --no-commit
```

### 3. Resolve conflicts

**Expected conflicts by category:**

| Type                                   | Action                                                 |
| -------------------------------------- | ------------------------------------------------------ |
| New upstream files with Chinese        | Translate to English before committing                 |
| Modified files we translated           | Keep our English version, apply upstream logic changes |
| `styles/glass/*`, `components/glass/*` | Always keep ours (upstream doesn't have these)         |
| `scripts/quick-install.ps1`            | Always keep ours                                       |
| `FORK_SYNC.md`                         | Always keep ours                                       |

### 4. Quick conflict resolution

For files where upstream only changed Chinese comments (not logic):

```bash
# Keep our translated version
git checkout --ours <file>
git add <file>
```

For files where upstream changed logic AND Chinese text:

```bash
# Open in editor, keep our English text, apply upstream logic changes
code <file>
```

### 5. Verify and commit

```bash
pnpm --filter chrome-mcp-server build   # verify build passes
git commit -m "chore: sync upstream/master"
```

## Files Safe to Auto-Keep Ours

These files only exist in our fork and will never conflict:

```
styles/glass/tokens.css
styles/glass/utilities.css
styles/glass/animations.css
components/glass/*.vue
components/glass/index.ts
scripts/quick-install.ps1
FORK_SYNC.md
```

## Files That Need Manual Merge

These are modified in both forks and need attention:

```
wxt.config.ts                    (we changed locale + component dirs)
entrypoints/background/index.ts  (we added display mode toggle)
useAgentTheme.ts                 (we added glass themes)
tailwind.css                     (we added glass imports)
```
