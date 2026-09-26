import { gql } from "@apollo/client";

export const BOOK_FIELDS = gql`
  fragment BookFields on Book {
    id
    title
    author
    year
    description
    coverUrl
    averageRating
    reviewsCount
    isFavorite
    shelfStatus
    tags {
      id
      name
    }
  }
`;

export const GET_BOOKS = gql`
  query GetBooks(
    $search: String
    $tag: String
    $tags: [String!]
    $sort: BookSort
    $first: Int
    $after: String
  ) {
    booksConnection(
      search: $search
      tag: $tag
      tags: $tags
      sort: $sort
      first: $first
      after: $after
    ) {
      totalCount
      edges {
        cursor
        node {
          ...BookFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  ${BOOK_FIELDS}
`;

export const GET_BOOK = gql`
  query GetBook($id: ID!, $reviewSort: ReviewSort) {
    book(id: $id) {
      ...BookFields
      coverUrl
      reviews(limit: 20, sort: $reviewSort) {
        id
        rating
        text
        likesCount
        likedByMe
        commentsCount
        createdAt
        user {
          id
          name
          isFollowing
        }
        comments(limit: 20) {
          id
          text
          createdAt
          user {
            id
            name
          }
        }
      }
    }
  }
  ${BOOK_FIELDS}
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      name
    }
  }
`;

export const REGISTER = gql`
  mutation Register($email: String!, $password: String!, $name: String!) {
    register(email: $email, password: $password, name: $name) {
      token
      refreshToken
      user {
        id
        email
        name
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      refreshToken
      user {
        id
        email
        name
      }
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout($token: String!) {
    logout(token: $token)
  }
`;

export const LOGOUT_ALL = gql`
  mutation LogoutAll {
    logoutAll
  }
`;

export const ADD_BOOK = gql`
  mutation AddBook(
    $title: String!
    $author: String!
    $year: Int
    $description: String
  ) {
    addBook(title: $title, author: $author, year: $year, description: $description) {
      ...BookFields
    }
  }
  ${BOOK_FIELDS}
`;

export const DELETE_BOOK = gql`
  mutation DeleteBook($id: ID!) {
    deleteBook(id: $id)
  }
`;

export const GET_SHELF = gql`
  query GetShelf($status: ShelfStatus) {
    myShelf(status: $status) {
      id
      status
      progress
      book {
        ...BookFields
      }
    }
  }
  ${BOOK_FIELDS}
`;

export const UPDATE_PROGRESS = gql`
  mutation UpdateProgress($bookId: ID!, $progress: Int!) {
    updateShelfProgress(bookId: $bookId, progress: $progress) {
      id
      status
      progress
    }
  }
`;

export const SET_SHELF_STATUS = gql`
  mutation SetShelfStatus($bookId: ID!, $status: ShelfStatus!) {
    setShelfStatus(bookId: $bookId, status: $status) {
      id
      status
    }
  }
`;

export const REMOVE_FROM_SHELF = gql`
  mutation RemoveFromShelf($bookId: ID!) {
    removeFromShelf(bookId: $bookId)
  }
`;

export const GET_FAVORITES = gql`
  query GetFavorites {
    myFavorites {
      ...BookFields
    }
  }
  ${BOOK_FIELDS}
`;

export const TOGGLE_FAVORITE = gql`
  mutation ToggleFavorite($bookId: ID!) {
    toggleFavorite(bookId: $bookId) {
      ...BookFields
    }
  }
  ${BOOK_FIELDS}
`;

export const UPSERT_REVIEW = gql`
  mutation UpsertReview($bookId: ID!, $rating: Int!, $text: String) {
    upsertReview(bookId: $bookId, rating: $rating, text: $text) {
      id
      rating
      text
    }
  }
`;

export const DELETE_REVIEW = gql`
  mutation DeleteReview($id: ID!) {
    deleteReview(id: $id)
  }
`;

export const GET_TAGS = gql`
  query GetTags($limit: Int) {
    tags(limit: $limit) {
      id
      name
      booksCount
    }
  }
`;

export const ADD_TAG = gql`
  mutation AddTag($bookId: ID!, $name: String!) {
    addTagToBook(bookId: $bookId, name: $name) {
      id
      tags {
        id
        name
      }
    }
  }
`;

export const REMOVE_TAG = gql`
  mutation RemoveTag($bookId: ID!, $name: String!) {
    removeTagFromBook(bookId: $bookId, name: $name) {
      id
      tags {
        id
        name
      }
    }
  }
`;

export const GET_UNREAD_COUNT = gql`
  query GetUnreadCount {
    unreadNotificationsCount
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications($limit: Int) {
    myNotifications(limit: $limit) {
      id
      type
      createdAt
      readAt
      actor {
        id
        name
      }
      book {
        id
        title
      }
    }
  }
`;

export const MARK_READ = gql`
  mutation MarkRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      readAt
    }
  }
`;

export const MARK_ALL_READ = gql`
  mutation MarkAllRead {
    markAllNotificationsRead
  }
`;

export const GET_RECOMMENDATIONS = gql`
  query GetRecommendations($limit: Int) {
    recommendations(limit: $limit) {
      book {
        id
        title
        author
        averageRating
        reviewsCount
      }
      score
      reason
    }
  }
`;

export const GET_GOALS = gql`
  query GetGoals {
    myGoals {
      id
      year
      target
      finishedCount
      remaining
      complete
    }
  }
`;

export const SET_GOAL = gql`
  mutation SetGoal($year: Int!, $target: Int!) {
    setGoal(year: $year, target: $target) {
      id
      year
      target
      finishedCount
      remaining
      complete
    }
  }
`;

export const GET_STATS = gql`
  query GetStats($year: Int!) {
    readingStats(year: $year) {
      month
      finished
    }
  }
`;

export const GET_CHALLENGES = gql`
  query GetChallenges($status: ChallengeStatus) {
    challenges(status: $status) {
      id
      name
      description
      startAt
      endAt
      target
      status
      memberCount
      isMember
      myProgress
    }
  }
`;

export const GET_CHALLENGE = gql`
  query GetChallenge($id: ID!) {
    challenge(id: $id) {
      id
      name
      description
      startAt
      endAt
      target
      status
      memberCount
      isMember
      myProgress
      leaderboard(limit: 10) {
        user {
          id
          name
        }
        finished
        percent
      }
    }
  }
`;

export const CREATE_CHALLENGE = gql`
  mutation CreateChallenge(
    $name: String!
    $description: String
    $startAt: Float!
    $endAt: Float!
    $target: Int!
  ) {
    createChallenge(
      name: $name
      description: $description
      startAt: $startAt
      endAt: $endAt
      target: $target
    ) {
      id
      name
    }
  }
`;

export const JOIN_CHALLENGE = gql`
  mutation JoinChallenge($id: ID!) {
    joinChallenge(id: $id) {
      id
      isMember
    }
  }
`;

export const LEAVE_CHALLENGE = gql`
  mutation LeaveChallenge($id: ID!) {
    leaveChallenge(id: $id)
  }
`;

export const GET_PREFS = gql`
  query GetPrefs {
    myNotificationPrefs {
      follow
      like
      comment
    }
  }
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($name: String!) {
    updateProfile(name: $name) {
      id
      name
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      token
      refreshToken
    }
  }
`;

export const SET_PREFS = gql`
  mutation SetPrefs($follow: Boolean, $like: Boolean, $comment: Boolean) {
    setNotificationPrefs(follow: $follow, like: $like, comment: $comment) {
      follow
      like
      comment
    }
  }
`;

export const IMPORT_BOOKS = gql`
  mutation ImportBooks($books: [BookImport!]!) {
    importBooks(books: $books) {
      imported
      matched
      shelved
      reviewed
      errors
    }
  }
`;

export const EXPORT_DATA = gql`
  query ExportData {
    exportData
  }
`;

export const EXPORT_CSV = gql`
  query ExportCsv {
    exportCsv
  }
`;

export const TOGGLE_REVIEW_LIKE = gql`
  mutation ToggleReviewLike($reviewId: ID!) {
    toggleReviewLike(reviewId: $reviewId) {
      id
      likesCount
      likedByMe
    }
  }
`;

export const ADD_COMMENT = gql`
  mutation AddComment($reviewId: ID!, $text: String!) {
    addComment(reviewId: $reviewId, text: $text) {
      id
      text
    }
  }
`;

export const UPDATE_COMMENT = gql`
  mutation UpdateComment($id: ID!, $text: String!) {
    updateComment(id: $id, text: $text) {
      id
      text
    }
  }
`;

export const DELETE_COMMENT = gql`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`;

export const FOLLOW_USER = gql`
  mutation FollowUser($userId: ID!) {
    followUser(userId: $userId) {
      id
      isFollowing
      followersCount
    }
  }
`;

export const UNFOLLOW_USER = gql`
  mutation UnfollowUser($userId: ID!) {
    unfollowUser(userId: $userId)
  }
`;

export const GET_FEED = gql`
  query GetFeed($limit: Int, $offset: Int) {
    activityFeed(limit: $limit, offset: $offset) {
      id
      type
      createdAt
      user {
        id
        name
      }
      book {
        id
        title
        author
      }
      review {
        id
        rating
        text
      }
      shelfStatus
    }
  }
`;
