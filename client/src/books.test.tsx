import { describe, expect, test, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./i18n";
import { BooksView } from "./App";
import { GET_BOOKS, GET_TAGS } from "./queries";

const BOOK = {
  __typename: "Book",
  id: "b1",
  title: "Dune",
  author: "Frank Herbert",
  year: 1965,
  description: "Desert epic",
  coverUrl: null,
  averageRating: 4.5,
  reviewsCount: 2,
  isFavorite: false,
  shelfStatus: null,
  tags: [],
};

const BASE_VARS = { search: null, tags: null, sort: "NEWEST", first: 20 };

function connection(books: unknown[], totalCount: number, hasNextPage = false) {
  return {
    booksConnection: {
      __typename: "BookConnection",
      totalCount,
      edges: (books as { id: string }[]).map((b) => ({
        __typename: "BookEdge",
        cursor: `cursor-${b.id}`,
        node: b,
      })),
      pageInfo: {
        __typename: "PageInfo",
        hasNextPage,
        endCursor: hasNextPage ? "cursor-last" : null,
      },
    },
  };
}

const mocks = [
  {
    request: { query: GET_TAGS, variables: { limit: 50 } },
    result: { data: { tags: [] } },
  },
  {
    request: { query: GET_BOOKS, variables: BASE_VARS },
    result: { data: connection([BOOK], 1) },
  },
  {
    request: {
      query: GET_BOOKS,
      variables: { ...BASE_VARS, search: "dune" },
    },
    result: { data: connection([BOOK], 1) },
  },
  {
    request: {
      query: GET_BOOKS,
      variables: { ...BASE_VARS, search: "dune", after: "cursor-last" },
    },
    result: { data: connection([], 1) },
  },
];

describe("books list", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders books and total count", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <LanguageProvider>
        <AuthProvider>
          <BooksView onOpen={() => {}} />
        </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });
    expect(screen.getByText(/1 book\(s\)/)).toBeInTheDocument();
    expect(screen.queryByText("Load more")).toBeNull();
  });

  test("search refetches with the query", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <LanguageProvider>
        <AuthProvider>
          <BooksView onOpen={() => {}} />
        </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Search/), {
      target: { value: "dune" },
    });

    await waitFor(() => {
      expect(screen.getByText(/match your filters/)).toBeInTheDocument();
    });
  });

  test("load more appends the next page", async () => {
    const BOOK2 = { ...BOOK, id: "b2", title: "Foundation" };
    const pageMocks = [
      mocks[0]!,
      {
        request: { query: GET_BOOKS, variables: BASE_VARS },
        result: { data: connection([BOOK], 2, true) },
      },
      {
        request: { query: GET_BOOKS, variables: { ...BASE_VARS, after: "cursor-last" } },
        result: { data: connection([BOOK2], 2) },
      },
    ];
    render(
      <MockedProvider mocks={pageMocks} addTypename={false}>
        <LanguageProvider>
        <AuthProvider>
          <BooksView onOpen={() => {}} />
        </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });
    expect(screen.getByText("Load more")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Load more"));

    await waitFor(() => {
      expect(screen.getByText("Foundation")).toBeInTheDocument();
    });
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.queryByText("Load more")).toBeNull();
  });
});
