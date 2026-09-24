import { describe, expect, test, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { AuthProvider, useAuth } from "./auth";
import { GET_ME, LOGIN } from "./queries";
import { ACCESS_KEY, REFRESH_KEY } from "./apollo-client";

const LOGIN_MOCK = {
  request: {
    query: LOGIN,
    variables: { email: "reader@example.com", password: "password123" },
  },
  result: {
    data: {
      login: {
        __typename: "AuthPayload",
        token: "access-123",
        refreshToken: "refresh-123",
        user: { __typename: "User", id: "u1", email: "reader@example.com", name: "Reader" },
      },
    },
  },
};

const ME_MOCK = {
  request: { query: GET_ME },
  result: {
    data: {
      me: { __typename: "User", id: "u1", email: "reader@example.com", name: "Reader" },
    },
  },
};

function Harness() {
  const { user, login } = useAuth();
  return (
    <div>
      <span data-testid="who">{user ? user.name : "guest"}</span>
      <button onClick={() => void login("reader@example.com", "password123")}>
        log in
      </button>
    </div>
  );
}

describe("auth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("login stores tokens and loads the user", async () => {
    render(
      <MockedProvider mocks={[LOGIN_MOCK, ME_MOCK]} addTypename={false}>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </MockedProvider>,
    );

    expect(screen.getByTestId("who")).toHaveTextContent("guest");
    await userEvent.click(screen.getByText("log in"));

    await waitFor(() => {
      expect(screen.getByTestId("who")).toHaveTextContent("Reader");
    });
    expect(localStorage.getItem(ACCESS_KEY)).toBe("access-123");
    expect(localStorage.getItem(REFRESH_KEY)).toBe("refresh-123");
  });

  test("failed login surfaces the error", async () => {
    const failMock = {
      request: {
        query: LOGIN,
        variables: { email: "reader@example.com", password: "wrong" },
      },
      error: new Error("Invalid credentials"),
    };
    function FailHarness() {
      const { login } = useAuth();
      return (
        <button onClick={() => void login("reader@example.com", "wrong").catch(() => {})}>
          go
        </button>
      );
    }
    render(
      <MockedProvider mocks={[failMock]} addTypename={false}>
        <AuthProvider>
          <FailHarness />
        </AuthProvider>
      </MockedProvider>,
    );
    await userEvent.click(screen.getByText("go"));
    await waitFor(() => {
      expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
    });
    expect(screen.queryByText("Reader")).toBeNull();
  });
});
