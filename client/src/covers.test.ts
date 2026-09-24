import { describe, expect, test } from "vitest";
import { coverSrc, apiBase } from "./covers";

describe("covers", () => {
  test("coverSrc resolves relative and absolute paths", () => {
    expect(coverSrc(null)).toBeNull();
    expect(coverSrc(undefined)).toBeNull();
    expect(coverSrc("https://cdn.example.com/x.png")).toBe("https://cdn.example.com/x.png");
    // No VITE_GRAPHQL_URL in test env -> relative path (dev proxy).
    expect(coverSrc("/covers/abc.png")).toBe("/covers/abc.png");
    expect(apiBase()).toBe("");
  });
});
