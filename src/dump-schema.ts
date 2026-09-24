import { typeDefs } from "./schema";

// Regenerates src/schema.graphql from the typeDefs source of truth.
// Client codegen (client/codegen.ts) reads ../src/schema.graphql.
await Bun.write("./src/schema.graphql", `${typeDefs.replace(/^#graphql\n/, "")}`);
console.log("Wrote src/schema.graphql");
