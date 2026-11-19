import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  env: core.env,
  extends: [core, react, next],
  ignorePatterns: [
    ...core.ignorePatterns,
    // Local agent and tool state is not project source.
    ".cachebro/**",
    ".oc/**",
  ],
  // Phase 2: re-enable one at a time. Violation counts as of 2026-11-18.
  rules: {
    "func-style": "off", // 20
    "react/button-has-type": "off", // 5
    "no-inline-comments": "off", // 2
    "typescript/no-non-null-assertion": "off", // 2
    "no-alert": "off", // 1
    "no-await-in-loop": "off", // 1
    "no-nested-ternary": "off", // 1
    "no-new": "off", // 1
  },
});
