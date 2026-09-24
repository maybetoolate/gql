import { describe, expect, test } from "vitest";
import { parseCsv, goodreadsToRows } from "./App";

const SAMPLE = [
  "Title,Author,My Rating,Exclusive Shelf,Original Publication Year",
  '"Dune","Frank Herbert",5,read,1965',
  '"The, Quoted Book","Some, Author",4,currently-reading,2001',
  '"Bad Row","",0,to-read,',
  "Plain Book,Jane Doe,0,,",
].join("\n");

describe("goodreads csv", () => {
  test("parses quoted commas and maps shelves", () => {
    const { rows, skipped } = goodreadsToRows(SAMPLE);
    expect(skipped).toBe(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      title: "Dune",
      author: "Frank Herbert",
      year: 1965,
      shelf: "finished",
      rating: 5,
    });
    expect(rows[1]).toMatchObject({
      title: "The, Quoted Book",
      author: "Some, Author",
      shelf: "reading",
      rating: 4,
    });
    expect(rows[2]).toMatchObject({
      title: "Plain Book",
      shelf: null,
      rating: null,
    });
  });

  test("rejects non-goodreads files", () => {
    const { rows, skipped } = goodreadsToRows("a,b\n1,2\n");
    expect(rows).toEqual([]);
    expect(skipped).toBe(1);
  });

  test("parseCsv handles quotes and blank lines", () => {
    expect(parseCsv('a,"b,c"\n\n"d""e",f\n')).toEqual([
      ["a", "b,c"],
      ['d"e', "f"],
    ]);
  });
});
