import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // The existing code already matches Ultracite's defaults (double quotes,
  // semicolons, 2-space indent), so no style options need carrying over.
  // Sorting is deferred to phase 2 to keep the initial reformat small.
  sortImports: false,
  sortPackageJson: false,
  ignorePatterns: [
    ...ultracite.ignorePatterns,
    // Local agent and tool state is not project source.
    ".cachebro/**",
    ".oc/**",
  ],
});
