import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the "no AI wording anywhere in the product" rule: scans every
 * user-facing source file for a short list of forbidden words/phrases
 * (AI/IA, model/tool names, "tokens", "tiempo real", etc.) and fails with
 * the exact file/line/snippet of every hit.
 *
 * Scope is intentionally narrow — `src/**\/*.tsx` and `src/components/**\/*.ts`
 * (the files that actually render UI copy) plus `data/kb/*.json` (the
 * knowledge-base tips/content shown in the quiz) — not every `.ts` file in
 * `src/domain`/`src/lib`, which is full of legitimate internal vocabulary
 * ("LLM", "tokens", "OpenRouter", model ids) that users never see.
 *
 * Two escape hatches for the rare legitimate exception:
 * - A path (or `*.test.*` file) can be added to the allowlist below.
 * - A single line can carry a trailing `// copy-audit-ignore` comment.
 */

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const COMPONENTS_DIR = path.join(ROOT, "src/components");
const KB_DIR = path.join(ROOT, "data/kb");

// --- forbidden wording -----------------------------------------------------

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\b(IA|AI|LLM|GPT|Qwen|DeepSeek|OpenRouter|Remotion)\b/i,
  /inteligencia artificial/i,
  /tiempo real/i,
  /\bmodelo\b/i,
  /\btokens?\b/i,
];

// --- allowlist: paths that are not user-facing ------------------------------

const ALLOWLISTED_PATH_PREFIXES = ["src/domain/ai/", "src/domain/kb/"];

const ALLOWLISTED_EXACT_PATHS = new Set<string>([
  "src/lib/env.ts",
  "src/domain/quiz/engine-prompt.ts",
  "src/domain/ai/experience-prompt.ts",
]);

function isAllowlistedPath(relativePath: string): boolean {
  if (relativePath.includes(".test.")) return true;
  if (ALLOWLISTED_EXACT_PATHS.has(relativePath)) return true;
  if (ALLOWLISTED_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) return true;
  // src/lib/<anything>-deps.ts (experience-deps.ts, quiz-engine-deps.ts, …):
  // server-only wiring, never rendered.
  if (/^src\/lib\/[\w-]+-deps\.ts$/.test(relativePath)) return true;
  return false;
}

// --- per-line escape hatch ---------------------------------------------------

const IGNORE_MARKER = "copy-audit-ignore";

// Lines that are (or close) a module specifier — `import … from "remotion"`,
// a multi-line import's closing `} from "...";`, dynamic `import("...")`,
// `require("...")` — never user-facing copy, but their string literal would
// otherwise trip the "Remotion"/"OpenRouter" patterns above.
const MODULE_SPECIFIER_LINE = /(^\s*import\b)|(\bfrom\s*["'])|(\brequire\s*\()|(\bimport\s*\()/;

// --- string/JSX-text extraction ---------------------------------------------

const DOUBLE_QUOTED = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
const SINGLE_QUOTED = /'([^'\\]*(?:\\.[^'\\]*)*)'/g;
const TEMPLATE_LITERAL = /`([^`]*)`/g;
const JSX_TEXT = />([^<>{}]+)</g;

function extractCandidateStrings(line: string): string[] {
  const found: string[] = [];
  for (const regex of [DOUBLE_QUOTED, SINGLE_QUOTED, TEMPLATE_LITERAL, JSX_TEXT]) {
    for (const match of line.matchAll(regex)) {
      const text = match[1]?.trim();
      if (text) found.push(text);
    }
  }
  return found;
}

// --- file discovery ----------------------------------------------------------

function walk(dir: string, matches: (filePath: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, matches, out);
    } else if (matches(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function toRelative(filePath: string): string {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function targetFiles(): string[] {
  const tsxFiles = walk(SRC_DIR, (file) => file.endsWith(".tsx"));
  const componentTsFiles = walk(COMPONENTS_DIR, (file) => file.endsWith(".ts"));
  const kbFiles = readdirSync(KB_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(KB_DIR, name));

  return [...new Set([...tsxFiles, ...componentTsFiles, ...kbFiles])];
}

// --- the audit ----------------------------------------------------------------

interface Violation {
  file: string;
  line: number;
  snippet: string;
  pattern: string;
}

function auditFile(filePath: string): Violation[] {
  const relativePath = toRelative(filePath);
  if (isAllowlistedPath(relativePath)) return [];

  const violations: Violation[] = [];
  const lines = readFileSync(filePath, "utf-8").split("\n");

  lines.forEach((line, index) => {
    if (line.includes(IGNORE_MARKER)) return;
    if (MODULE_SPECIFIER_LINE.test(line)) return;

    for (const candidate of extractCandidateStrings(line)) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(candidate)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            snippet: candidate,
            pattern: pattern.toString(),
          });
        }
      }
    }
  });

  return violations;
}

describe("copy audit: no AI wording in user-facing copy", () => {
  it("has no forbidden word/phrase in any scanned string literal or JSX text", () => {
    const violations = targetFiles().flatMap(auditFile);

    if (violations.length > 0) {
      const report = violations
        .map((v) => `${v.file}:${v.line} — "${v.snippet}" matched ${v.pattern}`)
        .join("\n");
      expect.fail(`Forbidden wording found:\n${report}`);
    }

    expect(violations).toEqual([]);
  });

  it("fails if 'Modo Swipe Activo' is reintroduced", () => {
    const hit = targetFiles().some((file) =>
      readFileSync(file, "utf-8").includes("Modo Swipe Activo"),
    );
    expect(hit).toBe(false);
  });

  it("fails if 'Remotion AI' is reintroduced", () => {
    const hit = targetFiles().some((file) => readFileSync(file, "utf-8").includes("Remotion AI"));
    expect(hit).toBe(false);
  });
});
