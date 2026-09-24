import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  // Local SDL dumped from the server (`bun run schema:dump` at repo root).
  // Falls back to the live server when the file is missing.
  schema: "../src/schema.graphql",
  documents: ["src/**/*.{ts,tsx}"],
  ignoreNoDocuments: true,
  generates: {
    "./src/types/__generated__/graphql.ts": {
      // typescript-operations only (v6 recommended for Apollo Client):
      // emits operation + fragment + enum-union types with no runtime code.
      plugins: ["typescript-operations"],
      config: {
        nonOptionalTypename: true,
        skipTypeNameForRoot: true,
      },
    },
  },
};

export default config;
