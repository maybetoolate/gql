import { ApolloServer } from "@apollo/server";
import depthLimit from "graphql-depth-limit";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword, signToken } from "../src/auth";
import { createLoaders } from "../src/loaders";
import { typeDefs, resolvers, type GraphQLContext } from "../src/schema";
import { eq } from "drizzle-orm";

let userSeq = 0;

export function makeServer() {
  return new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    validationRules: [depthLimit(10)],
  });
}

export interface ExecResult {
  data: Record<string, unknown> | null | undefined;
  errors: { message: string; code?: string }[] | undefined;
}

export async function exec(
  server: ApolloServer<GraphQLContext>,
  query: string,
  variables: Record<string, unknown> = {},
  userId: string | null = null,
): Promise<ExecResult> {
  let user = null;
  if (userId) {
    const rows = await db.select().from(users).where(eq(users.id, userId));
    user = rows[0] ?? null;
  }
  const res = await server.executeOperation(
    { query, variables },
    { contextValue: { user, loaders: createLoaders(userId) } },
  );
  const single =
    res.body.kind === "single" ? res.body.singleResult : ({} as Record<string, never>);
  const data = (single as { data?: ExecResult["data"] }).data;
  const errors = (single as { errors?: ExecResult["errors"] }).errors;
  return {
    data,
    errors: errors?.map((e) => ({
      message: e.message,
      code: (e.extensions as { code?: string } | undefined)?.code,
    })),
  };
}

export function expectOk<T = Record<string, never>>(
  res: ExecResult,
  path: string,
): T {
  if (res.errors?.length) {
    throw new Error(
      `Expected no errors for ${path}, got: ${res.errors.map((e) => `${e.code}:${e.message}`).join("; ")}`,
    );
  }
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, res.data);
  if (value === undefined || value === null) {
    throw new Error(`Expected data at ${path}, got ${JSON.stringify(res.data)}`);
  }
  return value as T;
}

export function expectCode(res: ExecResult, code: string) {
  const codes = res.errors?.map((e) => e.code) ?? [];
  if (!codes.includes(code)) {
    throw new Error(
      `Expected error code ${code}, got [${codes.join(",")}]: ${JSON.stringify(res.data)}`,
    );
  }
}

export async function createTestUser(prefix: string) {
  userSeq += 1;
  const email = `${prefix}-${userSeq}@example.com`;
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: `${prefix} ${userSeq}`,
      passwordHash: await hashPassword("password123"),
    })
    .returning();
  const token = await signToken(user);
  return { user, token };
}
