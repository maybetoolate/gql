import { describe, expect, test, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./i18n";
import { ChallengesView } from "./App";
import { GET_ME, GET_CHALLENGES, GET_CHALLENGE, JOIN_CHALLENGE } from "./queries";
import { ACCESS_KEY } from "./apollo-client";

const ME_MOCK = {
  request: { query: GET_ME },
  result: {
    data: {
      me: { __typename: "User", id: "u1", email: "c@example.com", name: "Chally" },
    },
  },
};

const CHALLENGE = {
  __typename: "Challenge",
  id: "c1",
  name: "October Sprint",
  description: null,
  startAt: 1700000000000,
  endAt: 1800000000000,
  target: 3,
  status: "ACTIVE",
  memberCount: 1,
  isMember: false,
  myProgress: 0,
};

const mocks = [
  ME_MOCK,
  {
    request: { query: GET_CHALLENGES, variables: { status: "ACTIVE" } },
    result: { data: { challenges: [CHALLENGE] } },
  },
  {
    request: { query: GET_CHALLENGE, variables: { id: "c1" } },
    result: {
      data: {
        challenge: {
          ...CHALLENGE,
          leaderboard: [
            {
              __typename: "ChallengeEntry",
              user: { __typename: "PublicProfile", id: "u9", name: "Racer" },
              finished: 2,
              percent: 67,
            },
          ],
        },
      },
    },
  },
  {
    request: { query: JOIN_CHALLENGE, variables: { id: "c1" } },
    result: {
      data: { joinChallenge: { __typename: "Challenge", id: "c1", isMember: true } },
    },
  },
  {
    request: { query: GET_CHALLENGES, variables: { status: "ACTIVE" } },
    result: {
      data: { challenges: [{ ...CHALLENGE, isMember: true, memberCount: 2 }] },
    },
  },
  {
    request: { query: GET_CHALLENGE, variables: { id: "c1" } },
    result: {
      data: {
        challenge: {
          ...CHALLENGE,
          isMember: true,
          memberCount: 2,
          leaderboard: [
            {
              __typename: "ChallengeEntry",
              user: { __typename: "PublicProfile", id: "u9", name: "Racer" },
              finished: 2,
              percent: 67,
            },
          ],
        },
      },
    },
  },
];

describe("challenges view", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(ACCESS_KEY, "token-1");
  });

  test("lists, expands leaderboard, and joins", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <LanguageProvider>
          <AuthProvider>
            <ChallengesView />
          </AuthProvider>
        </LanguageProvider>
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("October Sprint")).toBeInTheDocument();
    });
    expect(screen.getByText(/1 members/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("October Sprint"));
    await waitFor(() => {
      expect(screen.getByText(/Racer/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Join"));
    await waitFor(() => {
      expect(screen.getByText("Leave")).toBeInTheDocument();
    });
  });
});
