import { describe, expect, test, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import App, { Audit, Books } from "./App";
import { LanguageProvider, _dictsForTests } from "./i18n";
import { ADMIN_AUDIT, ADMIN_BOOKS, ADMIN_LOGIN, ADMIN_ME, ADMIN_STATS, MERGE_BOOKS } from "./queries";

function loginMocks(role: "admin" | "member") {
  return [
    {
      request: {
        query: ADMIN_LOGIN,
        variables: { email: "a@example.com", password: "password123" },
      },
      result: {
        data: {
          login: {
            __typename: "AuthPayload",
            token: "t",
            refreshToken: "r",
            user: { __typename: "User", id: "u1", email: "a@example.com", name: "A", role },
          },
        },
      },
    },
    {
      request: { query: ADMIN_ME },
      result: {
        data: {
          me: { __typename: "User", id: "u1", email: "a@example.com", name: "A", role },
        },
      },
    },
  ];
}

const STATS_MOCK = {
  request: { query: ADMIN_STATS },
  result: {
    data: {
      adminStats: {
        __typename: "AdminStats",
        userCount: 3,
        bookCount: 6,
        reviewCount: 2,
        commentCount: 1,
        shelfCount: 3,
        favoriteCount: 2,
        followCount: 1,
        tagCount: 8,
      },
    },
  },
};

describe("admin portal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("dictionaries share identical keys with no empty strings", () => {
    const leaves = (obj: unknown, prefix: string, out: Map<string, unknown>) => {
      if (typeof obj === "function" || typeof obj === "string") {
        out.set(prefix, obj);
        return;
      }
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          leaves(v, prefix ? `${prefix}.${k}` : k, out);
        }
      }
    };
    const check = (obj: unknown, prefix: string) => {
      if (typeof obj === "string" && obj.trim() === "") {
        throw new Error(`empty string at ${prefix}`);
      }
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          check(v, prefix ? `${prefix}.${k}` : k);
        }
      }
    };
    const enLeaves = new Map<string, unknown>();
    const esLeaves = new Map<string, unknown>();
    leaves(_dictsForTests.en, "", enLeaves);
    leaves(_dictsForTests.es, "", esLeaves);
    expect([...esLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
    expect(enLeaves.size).toBeGreaterThan(40);
    check(_dictsForTests.en, "en");
    check(_dictsForTests.es, "es");
  });

  test("admin login shows the dashboard", async () => {
    render(
      <MockedProvider mocks={[...loginMocks("admin"), STATS_MOCK]} addTypename={false}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </MockedProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText("Log in as admin"));

    await waitFor(() => {
      expect(screen.getByText("Bookshelf Admin")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Users")).toBeInTheDocument();
    });
  });

  test("non-admin login is refused", async () => {
    render(
      <MockedProvider mocks={loginMocks("member")} addTypename={false}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </MockedProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText("Log in as admin"));

    await waitFor(() => {
      expect(screen.getByText("This account is not an admin.")).toBeInTheDocument();
    });
    expect(localStorage.getItem("gql-token")).toBeNull();
  });

  test("spanish renders translated chrome", async () => {
    localStorage.setItem("gql-admin-lang", "es");
    render(
      <MockedProvider mocks={[...loginMocks("admin"), STATS_MOCK]} addTypename={false}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </MockedProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Correo"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Contraseña"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText("Iniciar sesión como admin"));

    await waitFor(() => {
      expect(screen.getByText("Resumen")).toBeInTheDocument();
    });
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
  });

  test("audit tab lists entries with actors", async () => {    render(
      <MockedProvider
        mocks={[
          {
            request: { query: ADMIN_AUDIT, variables: { limit: 50 } },
            result: {
              data: {
                auditLog: [
                  {
                    __typename: "AuditEntry",
                    id: "a1",
                    action: "BOOK_DELETE",
                    targetType: "book",
                    targetId: "b1",
                    detail: "Some Book",
                    createdAt: 1700000000000,
                    actor: { __typename: "User", id: "u1", email: "admin@example.com" },
                  },
                  {
                    __typename: "AuditEntry",
                    id: "a2",
                    action: "USER_DELETE",
                    targetType: "user",
                    targetId: "u9",
                    detail: null,
                    createdAt: 1700000001000,
                    actor: null,
                  },
                ],
              },
            },
          },
        ]}
        addTypename={false}
      >
        <LanguageProvider>
          <Audit />
        </LanguageProvider>
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    });
    expect(screen.getByText("BOOK_DELETE")).toBeInTheDocument();
    expect(screen.getByText("(deleted user)")).toBeInTheDocument();
  });

  test("merge flow picks a target and merges", async () => {
    const list = {
      request: { query: ADMIN_BOOKS, variables: { search: null, limit: 50 } },
      result: {
        data: {
          books: [
            {
              __typename: "Book",
              id: "b-src",
              title: "Dupe",
              author: "A",
              year: null,
              averageRating: 0,
              reviewsCount: 0,
            },
            {
              __typename: "Book",
              id: "b-dst",
              title: "Original",
              author: "A",
              year: null,
              averageRating: 0,
              reviewsCount: 0,
            },
          ],
        },
      },
    };
    const targets = {
      request: { query: ADMIN_BOOKS, variables: { search: null, limit: 10 } },
      result: {
        data: {
          books: [
            {
              __typename: "Book",
              id: "b-dst",
              title: "Original",
              author: "A",
              year: null,
              averageRating: 0,
              reviewsCount: 0,
            },
          ],
        },
      },
    };
    const merged = {
      request: {
        query: MERGE_BOOKS,
        variables: { sourceId: "b-src", targetId: "b-dst" },
      },
      result: {
        data: {
          mergeBooks: { __typename: "Book", id: "b-dst", title: "Original" },
        },
      },
    };
    const origConfirm = window.confirm;
    let confirmed = false;
    Object.defineProperty(window, "confirm", {
      value: () => {
        confirmed = true;
        return true;
      },
      writable: true,
      configurable: true,
    });
    try {
      render(
        <MockedProvider mocks={[list, targets, merged, { ...list }]} addTypename={false}>
          <LanguageProvider>
            <Books />
          </LanguageProvider>
        </MockedProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Dupe")).toBeInTheDocument();
      });
      fireEvent.click(screen.getAllByText("Merge…")[0]!);
      await waitFor(() => {
        expect(screen.getByText(/Original/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Merge into…" }));
      await waitFor(() => {
        expect(confirmed).toBe(true);
      });
    } finally {
      Object.defineProperty(window, "confirm", {
        value: origConfirm,
        writable: true,
        configurable: true,
      });
    }
  });
});
