# Phase 0 — Tooling Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the lint/format/CI toolchain (ESLint, Prettier, Ruff/Black, GitHub Actions skeleton) across the monorepo **without changing any runtime behavior** — the foundation that makes the later strict-TypeScript migration safe.

**Architecture:** Root-level flat ESLint config + Prettier + `.editorconfig` cover the JS/Vue workspaces (web, api, packages, e2e); `pyproject.toml` covers the 3 Python files. A one-time Prettier reformat lands as an isolated commit recorded in `.git-blame-ignore-revs`. CI runs `format:check` + the existing test suites only; `lint`/`typecheck` gates are added in later phases (kademeli). ESLint config starts **non-type-checked** (no tsconfig exists yet) and is upgraded to `recommendedTypeChecked` in Phase 1.

**Tech Stack:** Node 24, npm workspaces, ESLint 9 (flat config), `typescript-eslint`, `eslint-plugin-vue`, `eslint-config-prettier`, Prettier, Ruff, Black, GitHub Actions.

**Branch:** `tooling-strict-ts-migration` (already created).

**Scope note:** This plan is Phase 0 of the spec `docs/superpowers/specs/2026-06-08-tooling-strict-ts-migration-design.md`. Phases 1–7 get their own plans, written as each prior phase establishes the real types/structure.

---

### Task 1: Install toolchain dev dependencies (root)

**Files:**
- Modify: `package.json` (root) — `devDependencies`

- [ ] **Step 1: Install dev dependencies at the workspace root**

Run:
```bash
npm install -D -W eslint@^9 typescript-eslint@^8 eslint-plugin-vue@^9 eslint-config-prettier@^9 @eslint/js@^9 globals@^15 prettier@^3 typescript@^5 vue-tsc@^2 tsx@^4
```

(`-W` installs into the workspace root `package.json`. `typescript`/`vue-tsc`/`tsx` are installed now so later phases need no new install.)

- [ ] **Step 2: Verify the tools resolve**

Run:
```bash
npx eslint --version && npx prettier --version && npx tsc --version
```
Expected: three version strings print (eslint 9.x, prettier 3.x, tsc 5.x). No errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add lint/format/typescript toolchain dev deps"
```

---

### Task 2: Prettier + EditorConfig configuration

**Files:**
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `.editorconfig`

- [ ] **Step 1: Create `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "semi": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "es5",
  "endOfLine": "lf"
}
```

- [ ] **Step 2: Create `.prettierignore`**

```
node_modules
**/node_modules
dist
**/dist
coverage
**/coverage
package-lock.json
**/package-lock.json
*.md
docs
report.md
website
assets
**/*.snap
services/web/tests/helpers
```

(Markdown and `docs/` are excluded so the format commit stays focused on code, not prose churn.)

- [ ] **Step 3: Create `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.py]
indent_size = 4

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Verify Prettier reads the config (check mode, no writes yet)**

Run:
```bash
npx prettier --check "services/**/*.{js,vue,json,css}" "packages/**/*.{js,json}"
```
Expected: prints a list of files that "would change" (this is expected — formatting happens in Task 3). Command exits non-zero; that is fine here.

- [ ] **Step 5: Commit**

```bash
git add .prettierrc.json .prettierignore .editorconfig
git commit -m "chore: add Prettier and EditorConfig configuration"
```

---

### Task 3: One-time Prettier reformat (format-only commit)

**Files:**
- Modify: all JS/Vue/JSON/CSS under `services/`, `packages/`, `e2e/` (formatting only)
- Create: `.git-blame-ignore-revs`

- [ ] **Step 1: Run Prettier in write mode across the code**

Run:
```bash
npx prettier --write "services/**/*.{js,vue,json,css}" "packages/**/*.{js,json}" "e2e/**/*.{js,json}"
```
Expected: prints each formatted file. No errors.

- [ ] **Step 2: Confirm the diff is formatting-only**

Run:
```bash
git diff --stat
```
Expected: many files changed, but spot-check 2–3 with `git diff <file>` — only whitespace/quote/line-wrap changes, no logic changes.

- [ ] **Step 3: Run the existing test suites to prove zero behavior change**

Run:
```bash
cd services/web && npm run test:unit && npm test && cd ../..
```
Expected: 515 unit tests pass, 114 engine tests pass. (If `python` is on PATH the codegen-validity test also runs; otherwise it self-skips.)

- [ ] **Step 4: Commit the format pass as an isolated commit**

```bash
git add -A
git commit -m "style: apply Prettier formatting across codebase (no logic changes)"
```

- [ ] **Step 5: Record the format commit in `.git-blame-ignore-revs`**

Get the hash:
```bash
git rev-parse HEAD
```
Create `.git-blame-ignore-revs` with that hash and a comment:
```
# Bulk Prettier reformat — no logic changes. Ignore in git blame.
<paste-the-hash-from-above>
```

- [ ] **Step 6: Configure git to use it locally (optional but recommended)**

Run:
```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

- [ ] **Step 7: Commit**

```bash
git add .git-blame-ignore-revs
git commit -m "chore: ignore Prettier reformat commit in git blame"
```

---

### Task 4: Python formatting/linting (Ruff + Black)

**Files:**
- Create: `pyproject.toml`
- Modify: `services/renderer/worker.py`, `services/audio/worker.py`, `services/web/tests/helpers/ast_check.py` (formatting only)

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[tool.black]
line-length = 100
target-version = ["py311"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
ignore = []
```

- [ ] **Step 2: Run Ruff autofix and Black**

Run:
```bash
python -m pip install ruff black
ruff check --fix services/renderer/worker.py services/audio/worker.py services/web/tests/helpers/ast_check.py
black services/renderer/worker.py services/audio/worker.py services/web/tests/helpers/ast_check.py
```
Expected: Ruff reports fixes (or "All checks passed"); Black reformats or reports "unchanged". No errors.

- [ ] **Step 3: Verify Ruff/Black are clean**

Run:
```bash
ruff check services/renderer/worker.py services/audio/worker.py services/web/tests/helpers/ast_check.py
black --check services/renderer/worker.py services/audio/worker.py services/web/tests/helpers/ast_check.py
```
Expected: `All checks passed!` and `would reformat 0 files` / `3 files would be left unchanged`.

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml services/renderer/worker.py services/audio/worker.py services/web/tests/helpers/ast_check.py
git commit -m "chore: add Ruff/Black config and format Python workers"
```

---

### Task 5: ESLint flat config (non-type-checked baseline)

**Files:**
- Create: `eslint.config.js` (root)

- [ ] **Step 1: Create `eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'services/web/tests/helpers/**',
      '**/*.snap',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    // Browser code (frontend)
    files: ['services/web/**/*.{js,vue}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Node code (api, codegen, config files, e2e)
    files: [
      'services/api/**/*.js',
      'packages/**/*.js',
      'e2e/**/*.js',
      '**/*.config.js',
      'eslint.config.js',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Tests
    files: ['**/tests/**', '**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  prettier
);
```

(Note: `recommendedTypeChecked` + `stylisticTypeChecked` and `parserOptions.project` are added in Phase 1, once `tsconfig.base.json` exists. This baseline runs on plain JS/Vue today.)

- [ ] **Step 2: Run ESLint to confirm the config loads and parses the repo**

Run:
```bash
npx eslint . || true
```
Expected: ESLint runs and prints warnings/errors for existing code. It is **expected** to report violations at this stage — they are NOT fixed in Phase 0 and CI does not gate on lint yet. The only failure that matters here is a *config/parse crash* (e.g. "Cannot read config"). There must be no such crash.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore: add ESLint flat config (non-type-checked baseline)"
```

---

### Task 6: Root npm scripts for lint/format

**Files:**
- Modify: `package.json` (root) — `scripts`

- [ ] **Step 1: Add scripts to the root `package.json`**

Add a `scripts` block (the root currently has none):
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"services/**/*.{js,vue,json,css}\" \"packages/**/*.{js,json}\" \"e2e/**/*.{js,json}\"",
    "format:check": "prettier --check \"services/**/*.{js,vue,json,css}\" \"packages/**/*.{js,json}\" \"e2e/**/*.{js,json}\""
  }
}
```

(Insert this `scripts` key alongside the existing `name`/`workspaces`/`devDependencies` keys — do not remove the existing keys.)

- [ ] **Step 2: Verify `format:check` passes (the codebase was formatted in Task 3)**

Run:
```bash
npm run format:check
```
Expected: `All matched files use Prettier code style!` — exit code 0.

- [ ] **Step 3: Verify `lint` runs (non-gating)**

Run:
```bash
npm run lint || true
```
Expected: runs without a config crash (violations may print).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add root lint/format npm scripts"
```

---

### Task 7: GitHub Actions CI skeleton

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:

jobs:
  node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: npm ci
      - name: Prettier format check
        run: npm run format:check
      - name: Web unit tests
        run: npm run test:unit --workspace services/web
      - name: Engine tests
        run: npm test --workspace services/web
      # NOTE: `npm run lint` and typecheck are added as gates in Phase 6,
      # once the codebase is migrated and violations are resolved.

  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: python -m pip install ruff black
      - name: Ruff
        run: ruff check services/renderer/worker.py services/audio/worker.py services/web/tests/helpers/ast_check.py
      - name: Black
        run: black --check services/renderer/worker.py services/audio/worker.py services/web/tests/helpers/ast_check.py
```

(`setup-python` is in the `node` job so the `codegen-python-validity` test runs instead of self-skipping; it only needs the Python stdlib `ast`, not Manim.)

- [ ] **Step 2: Validate the workflow YAML locally**

Run:
```bash
node -e "import('node:fs').then(fs=>import('yaml').catch(()=>null)).then(()=>console.log('yaml present or skip'))" || true
python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('CI YAML valid')"
```
Expected: `CI YAML valid` (uses Python's PyYAML which is commonly available; if not installed, run `python -m pip install pyyaml` first).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions skeleton (format check + tests)"
```

---

### Task 8: Phase 0 verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full local verification run**

Run:
```bash
npm run format:check
npm run test:unit --workspace services/web
npm test --workspace services/web
```
Expected: format check clean (exit 0); 515 unit tests pass; 114 engine tests pass.

- [ ] **Step 2: Confirm no runtime/source logic changed**

Run:
```bash
git log --oneline tooling-strict-ts-migration ^main
```
Expected: commits are limited to config additions + the isolated Prettier/Black format commits. No commit touches application logic.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin tooling-strict-ts-migration
```
Expected: branch pushed; CI triggers and the `node` + `python` jobs go green.

---

## Self-Review

**Spec coverage (Phase 0 portion of the spec):**
- ESLint config → Task 5 ✅
- Prettier + `.editorconfig` + `.prettierignore` → Task 2 ✅
- `pyproject.toml` (Ruff/Black) → Task 4 ✅
- Root scripts → Task 6 ✅
- One-time Prettier format commit + `.git-blame-ignore-revs` → Task 3 ✅
- Python black/ruff fix → Task 4 ✅
- CI skeleton (`format:check` + tests) → Task 7 ✅
- Verification (format:check clean, tests green, diff is format-only) → Task 3/Task 8 ✅
- Phases 1–7 → out of scope for this plan (separate plans) ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every config file has complete contents; every command has expected output. ✅

**Type/name consistency:** Script names (`lint`, `lint:fix`, `format`, `format:check`) used identically in Task 6 and Task 7/8. ESLint config filename `eslint.config.js` consistent across Tasks 5–8. ✅

**Known deviation from spec, intentional:** ESLint baseline is non-type-checked in Phase 0 (no tsconfig yet) and upgraded to `recommendedTypeChecked` in Phase 1 — documented in the header and Task 5. This honors the spec's "kademeli gate" design.
