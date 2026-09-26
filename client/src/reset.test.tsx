import { describe, expect, test, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MockedProvider } from "@apollo/client/testing";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./i18n";
import { ForgotForm, ResetPasswordView } from "./App";
import { REQUEST_RESET, RESET_PASSWORD } from "./queries";
import { ACCESS_KEY, REFRESH_KEY } from "./apollo-client";

describe("password reset", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "";
  });

  test("forgot form requests a link", async () => {    const noop = () => {};
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: REQUEST_RESET, variables: { email: "r@example.com" } },
            result: { data: { requestPasswordReset: true } },
          },
        ]}
        addTypename={false}
      >
        <LanguageProvider>
          <AuthProvider>
            <ForgotForm onBack={noop} />
          </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "r@example.com" },
    });
    fireEvent.click(screen.getByText("Send reset link"));

    await waitFor(() => {
      expect(screen.getByText(/reset link is on its way/)).toBeInTheDocument();
    });
  });

  test("reset form exchanges the token for a session", async () => {
    window.location.hash = "#token=reset-abc";
    render(
      <MockedProvider
        mocks={[
          {
            request: {
              query: RESET_PASSWORD,
              variables: { token: "reset-abc", newPassword: "newpass123" },
            },
            result: {
              data: {
                resetPassword: {
                  __typename: "AuthPayload",
                  token: "new-access",
                  refreshToken: "new-refresh",
                },
              },
            },
          },
        ]}
        addTypename={false}
      >
        <LanguageProvider>
          <AuthProvider>
            <MemoryRouter>
              <ResetPasswordView />
            </MemoryRouter>
          </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText(/New password/), {
      target: { value: "newpass123" },
    });
    fireEvent.click(screen.getByText("Set new password"));

    await waitFor(() => {
      expect(localStorage.getItem(ACCESS_KEY)).toBe("new-access");
    });
    expect(localStorage.getItem(REFRESH_KEY)).toBe("new-refresh");
  });

  test("missing token shows invalid message", async () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <LanguageProvider>
          <AuthProvider>
            <MemoryRouter>
              <ResetPasswordView />
            </MemoryRouter>
          </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );
    expect(await screen.findByText(/invalid or expired/)).toBeInTheDocument();
  });

  test("forgot form surfaces request failures", async () => {
    const noop = () => {};
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: REQUEST_RESET, variables: { email: "r@example.com" } },
            error: new Error("Network down"),
          },
        ]}
        addTypename={false}
      >
        <LanguageProvider>
          <AuthProvider>
            <ForgotForm onBack={noop} />
          </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "r@example.com" },
    });
    const submit = screen.getByText("Send reset link");
    fireEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByText("Network down")).toBeInTheDocument();
    });
    expect(screen.queryByText(/reset link is on its way/)).toBeNull();
  });
});
