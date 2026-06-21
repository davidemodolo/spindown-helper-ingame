// This is the configuration file for ESLint, the TypeScript linter:
// https://eslint.org/docs/latest/use/configure/

// @ts-check

import { completeConfigBase } from "eslint-config-complete";
import { isaacScriptModConfigBase } from "eslint-config-isaacscript";
import { defineConfig } from "eslint/config";

export default defineConfig(
  // https://github.com/complete-ts/complete/blob/main/packages/eslint-config-complete/src/base.js
  ...completeConfigBase,

  // https://github.com/IsaacScript/isaacscript/blob/main/packages/eslint-config-isaacscript/src/base.js
  ...isaacScriptModConfigBase,

  {
    rules: {
      // Insert changed or disabled rules here, if necessary.

      // The IsaacScript Lua API types do not accurately represent runtime nullability. Conditions
      // like `if (player !== undefined)` are necessary at runtime even if TypeScript thinks they
      // cannot happen.
      "@typescript-eslint/no-unnecessary-condition": "off",

      // Non-null assertions (!) are required in IsaacScript because the Lua-to-TypeScript bindings
      // do not accurately track nullability. Array indexing (e.g. `pools[0]`) can return undefined
      // at runtime even when TypeScript believes it cannot.
      "@typescript-eslint/no-non-null-assertion": "off",

      // Non-null assertions often trigger this companion rule claiming the assertion is
      // unnecessary, but in IsaacScript it is necessary.
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
);
