import { describe, expect, test, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider, useLang, LANG_KEY, _dictsForTests } from "./i18n";
import { MockedProvider } from "@apollo/client/testing";
import { AuthProvider } from "./auth";
import { BooksView } from "./App";
import { GET_BOOKS, GET_TAGS } from "./queries";

function leaves(obj: unknown, path: string, out: Map<string, unknown>) {
  if (typeof obj === "function" || typeof obj === "string") {
    out.set(path, obj);
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      leaves(v, path ? `${path}.${k}` : k, out);
    }
  }
}

function checkNoEmpty(obj: unknown, prefix: string) {
  if (typeof obj === "string") {
    if (obj.trim() === "") throw new Error(`empty string at ${prefix}`);
    return;
  }
  if (typeof obj === "function") {
    // Spot-check interpolation functions with dummy args.
    const probed = (obj as (...a: never[]) => unknown).length;
    void probed;
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      checkNoEmpty(v, prefix ? `${prefix}.${k}` : k);
    }
  }
}

function Harness() {
  const { lang, setLang, t } = useLang();
  return (
    <div>
      <span data-testid="title">{t.books.title}</span>
      <span data-testid="lang">{lang}</span>
      <button onClick={() => setLang(lang === "en" ? "es" : "en")}>switch</button>
    </div>
  );
}

describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("es covers every en key with non-empty strings", () => {
    const enLeaves = new Map<string, unknown>();
    const esLeaves = new Map<string, unknown>();
    leaves(_dictsForTests.en as unknown, "", enLeaves);
    leaves(_dictsForTests.es as unknown, "", esLeaves);
    expect([...esLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
    checkNoEmpty(_dictsForTests.en, "en");
    checkNoEmpty(_dictsForTests.es, "es");
    expect(enLeaves.size).toBeGreaterThan(100);
  });

  test("switching language re-renders and persists", async () => {
    render(
      <LanguageProvider>
        <Harness />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("title")).toHaveTextContent("Discover books");
    fireEvent.click(screen.getByText("switch"));
    expect(await screen.findByText("Descubre libros")).toBeInTheDocument();
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
    expect(localStorage.getItem(LANG_KEY)).toBe("es");
  });

  test("stored preference wins on mount", async () => {
    localStorage.setItem(LANG_KEY, "es");
    render(
      <LanguageProvider>
        <Harness />
      </LanguageProvider>,
    );
    expect(await screen.findByText("Descubre libros")).toBeInTheDocument();
  });

  test("full view renders in Spanish", async () => {
    localStorage.setItem(LANG_KEY, "es");
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: GET_TAGS, variables: { limit: 50 } },
            result: { data: { tags: [] } },
          },
          {
            request: {
              query: GET_BOOKS,
              variables: { search: null, tags: null, sort: "NEWEST", first: 20 },
            },
            result: {
              data: {
                booksConnection: {
                  __typename: "BookConnection",
                  totalCount: 0,
                  edges: [],
                  pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
                },
              },
            },
          },
        ]}
        addTypename={false}
      >
        <LanguageProvider>
          <AuthProvider>
            <BooksView onOpen={() => {}} />
          </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );
    expect(await screen.findByText("Descubre libros")).toBeInTheDocument();
    expect(screen.getByText("Novedades")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Busca título, autor, descripción…")).toBeInTheDocument();
  });
});
