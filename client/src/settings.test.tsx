import { describe, expect, test, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./i18n";
import { SettingsView } from "./App";
import { GET_ME, GET_PREFS, UPDATE_PROFILE } from "./queries";
import { ACCESS_KEY } from "./apollo-client";

const mocks = [
  {
    request: { query: GET_ME },
    result: {
      data: {
        me: { __typename: "User", id: "u1", email: "s@example.com", name: "Sam" },
      },
    },
  },
  {
    request: { query: GET_PREFS },
    result: {
      data: {
        myNotificationPrefs: { __typename: "NotificationPrefs", follow: true, like: false, comment: true },
      },
    },
  },
  {
    request: { query: UPDATE_PROFILE, variables: { name: "Samuel" } },
    result: {
      data: { updateProfile: { __typename: "User", id: "u1", name: "Samuel" } },
    },
  },
];

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(ACCESS_KEY, "token-1");
  });

  test("renders profile, password, and prefs with toggles", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <LanguageProvider>
          <AuthProvider>
            <SettingsView />
          </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("Display name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Current password")).toBeInTheDocument();
    const likeToggle = screen.getByLabelText("Likes on my reviews") as HTMLInputElement;
    expect(likeToggle.checked).toBe(false);
    expect(
      (screen.getByLabelText("New followers") as HTMLInputElement).checked,
    ).toBe(true);
  });

  test("saving a new name fires the mutation", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <LanguageProvider>
          <AuthProvider>
            <SettingsView />
          </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Display name")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Display name"), {
      target: { value: "Samuel" },
    });
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload },
      writable: true,
    });
    fireEvent.click(screen.getByText("Save name"));
    await waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
  });
});
