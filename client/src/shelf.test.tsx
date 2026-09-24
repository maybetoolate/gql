import { describe, expect, test, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./i18n";
import { ShelfView } from "./App";
import { GET_ME, GET_SHELF, GET_STATS, UPDATE_PROGRESS } from "./queries";
import { ACCESS_KEY } from "./apollo-client";

const ME_MOCK = {
  request: { query: GET_ME },
  result: {
    data: {
      me: { __typename: "User", id: "u1", email: "s@example.com", name: "Shelver" },
    },
  },
};

const SHELF_ITEM = {
  __typename: "ShelfItem",
  id: "s1",
  status: "reading",
  progress: 30,
  book: {
    __typename: "Book",
    id: "b1",
    title: "Dune",
    author: "Frank Herbert",
    year: 1965,
    description: null,
    averageRating: 4,
    reviewsCount: 1,
    isFavorite: false,
    shelfStatus: "reading",
    tags: [],
  },
};

const mocks = [
  ME_MOCK,
  {
    request: { query: GET_SHELF },
    result: { data: { myShelf: [SHELF_ITEM] } },
  },
  {
    request: { query: GET_STATS, variables: { year: new Date().getFullYear() } },
    result: {
      data: {
        readingStats: Array.from({ length: 12 }, (_, i) => ({
          __typename: "MonthlyCount",
          month: i + 1,
          finished: i === 0 ? 2 : 0,
        })),
      },
    },
  },
  {
    request: {
      query: UPDATE_PROGRESS,
      variables: { bookId: "b1", progress: 40 },
    },
    result: {
      data: {
        updateShelfProgress: { __typename: "ShelfItem", id: "s1", status: "reading", progress: 40 },
      },
    },
  },
  {
    request: { query: GET_SHELF },
    result: {
      data: { myShelf: [{ ...SHELF_ITEM, progress: 40 }] },
    },
  },
];

describe("shelf progress", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(ACCESS_KEY, "token-1");
  });

  test("progress stepper updates the shelf", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <LanguageProvider>
        <AuthProvider>
          <ShelfView onOpen={() => {}} />
        </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(
      screen.getByText(`Finished per month — ${new Date().getFullYear()}`),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("+10"));

    await waitFor(() => {
      expect(screen.getByText("40%")).toBeInTheDocument();
    });
  });
});
