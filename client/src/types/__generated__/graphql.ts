/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type ActivityType =
  | 'FAVORITE'
  | 'REVIEW'
  | 'SHELF_UPDATE';

export type BookImport = {
  author: string;
  description?: string | null | undefined;
  rating?: number | null | undefined;
  reviewText?: string | null | undefined;
  shelf?: ShelfStatus | null | undefined;
  title: string;
  year?: number | null | undefined;
};

export type BookSort =
  | 'AUTHOR'
  | 'NEWEST'
  | 'RATING'
  | 'TITLE';

export type ChallengeStatus =
  | 'ACTIVE'
  | 'ENDED'
  | 'UPCOMING';

export type NotificationType =
  | 'FOLLOW'
  | 'REVIEW_COMMENT'
  | 'REVIEW_LIKE';

export type ReviewSort =
  | 'NEWEST'
  | 'TOP';

export type ShelfStatus =
  | 'finished'
  | 'reading'
  | 'want_to_read';

export type BookFieldsFragment = { __typename: 'Book', id: string, title: string, author: string, year: number | null, description: string | null, coverUrl: string | null, averageRating: number, reviewsCount: number, isFavorite: boolean, shelfStatus: ShelfStatus | null, tags: Array<{ __typename: 'Tag', id: string, name: string }> };

export type GetBooksQueryVariables = Exact<{
  search?: string | null | undefined;
  tag?: string | null | undefined;
  tags?: Array<string> | string | null | undefined;
  sort?: BookSort | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type GetBooksQuery = { booksConnection: { __typename: 'BookConnection', totalCount: number, edges: Array<{ __typename: 'BookEdge', cursor: string, node: { __typename: 'Book', id: string, title: string, author: string, year: number | null, description: string | null, coverUrl: string | null, averageRating: number, reviewsCount: number, isFavorite: boolean, shelfStatus: ShelfStatus | null, tags: Array<{ __typename: 'Tag', id: string, name: string }> } }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type GetBookQueryVariables = Exact<{
  id: string | number;
  reviewSort?: ReviewSort | null | undefined;
}>;


export type GetBookQuery = { book: { __typename: 'Book', coverUrl: string | null, id: string, title: string, author: string, year: number | null, description: string | null, averageRating: number, reviewsCount: number, isFavorite: boolean, shelfStatus: ShelfStatus | null, reviews: Array<{ __typename: 'Review', id: string, rating: number, text: string | null, likesCount: number, likedByMe: boolean, commentsCount: number, createdAt: number, user: { __typename: 'User', id: string, name: string, isFollowing: boolean }, comments: Array<{ __typename: 'ReviewComment', id: string, text: string, createdAt: number, user: { __typename: 'User', id: string, name: string } }> }>, tags: Array<{ __typename: 'Tag', id: string, name: string }> } | null };

export type GetMeQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMeQuery = { me: { __typename: 'User', id: string, email: string, name: string } | null };

export type RegisterMutationVariables = Exact<{
  email: string;
  password: string;
  name: string;
}>;


export type RegisterMutation = { register: { __typename: 'AuthPayload', token: string, refreshToken: string, user: { __typename: 'User', id: string, email: string, name: string } } };

export type LoginMutationVariables = Exact<{
  email: string;
  password: string;
}>;


export type LoginMutation = { login: { __typename: 'AuthPayload', token: string, refreshToken: string, user: { __typename: 'User', id: string, email: string, name: string } } };

export type LogoutMutationVariables = Exact<{
  token: string;
}>;


export type LogoutMutation = { logout: boolean };

export type LogoutAllMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutAllMutation = { logoutAll: boolean };

export type RequestResetMutationVariables = Exact<{
  email: string;
}>;


export type RequestResetMutation = { requestPasswordReset: boolean };

export type ResetPasswordMutationVariables = Exact<{
  token: string;
  newPassword: string;
}>;


export type ResetPasswordMutation = { resetPassword: { __typename: 'AuthPayload', token: string, refreshToken: string } };

export type AddBookMutationVariables = Exact<{
  title: string;
  author: string;
  year?: number | null | undefined;
  description?: string | null | undefined;
}>;


export type AddBookMutation = { addBook: { __typename: 'Book', id: string, title: string, author: string, year: number | null, description: string | null, coverUrl: string | null, averageRating: number, reviewsCount: number, isFavorite: boolean, shelfStatus: ShelfStatus | null, tags: Array<{ __typename: 'Tag', id: string, name: string }> } };

export type DeleteBookMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteBookMutation = { deleteBook: boolean };

export type GetShelfQueryVariables = Exact<{
  status?: ShelfStatus | null | undefined;
}>;


export type GetShelfQuery = { myShelf: Array<{ __typename: 'ShelfItem', id: string, status: ShelfStatus, progress: number, book: { __typename: 'Book', id: string, title: string, author: string, year: number | null, description: string | null, coverUrl: string | null, averageRating: number, reviewsCount: number, isFavorite: boolean, shelfStatus: ShelfStatus | null, tags: Array<{ __typename: 'Tag', id: string, name: string }> } }> };

export type UpdateProgressMutationVariables = Exact<{
  bookId: string | number;
  progress: number;
}>;


export type UpdateProgressMutation = { updateShelfProgress: { __typename: 'ShelfItem', id: string, status: ShelfStatus, progress: number } };

export type SetShelfStatusMutationVariables = Exact<{
  bookId: string | number;
  status: ShelfStatus;
}>;


export type SetShelfStatusMutation = { setShelfStatus: { __typename: 'ShelfItem', id: string, status: ShelfStatus } };

export type RemoveFromShelfMutationVariables = Exact<{
  bookId: string | number;
}>;


export type RemoveFromShelfMutation = { removeFromShelf: boolean };

export type GetFavoritesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetFavoritesQuery = { myFavorites: Array<{ __typename: 'Book', id: string, title: string, author: string, year: number | null, description: string | null, coverUrl: string | null, averageRating: number, reviewsCount: number, isFavorite: boolean, shelfStatus: ShelfStatus | null, tags: Array<{ __typename: 'Tag', id: string, name: string }> }> };

export type ToggleFavoriteMutationVariables = Exact<{
  bookId: string | number;
}>;


export type ToggleFavoriteMutation = { toggleFavorite: { __typename: 'Book', id: string, title: string, author: string, year: number | null, description: string | null, coverUrl: string | null, averageRating: number, reviewsCount: number, isFavorite: boolean, shelfStatus: ShelfStatus | null, tags: Array<{ __typename: 'Tag', id: string, name: string }> } };

export type UpsertReviewMutationVariables = Exact<{
  bookId: string | number;
  rating: number;
  text?: string | null | undefined;
}>;


export type UpsertReviewMutation = { upsertReview: { __typename: 'Review', id: string, rating: number, text: string | null } };

export type DeleteReviewMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteReviewMutation = { deleteReview: boolean };

export type GetTagsQueryVariables = Exact<{
  limit?: number | null | undefined;
}>;


export type GetTagsQuery = { tags: Array<{ __typename: 'Tag', id: string, name: string, booksCount: number }> };

export type AddTagMutationVariables = Exact<{
  bookId: string | number;
  name: string;
}>;


export type AddTagMutation = { addTagToBook: { __typename: 'Book', id: string, tags: Array<{ __typename: 'Tag', id: string, name: string }> } };

export type RemoveTagMutationVariables = Exact<{
  bookId: string | number;
  name: string;
}>;


export type RemoveTagMutation = { removeTagFromBook: { __typename: 'Book', id: string, tags: Array<{ __typename: 'Tag', id: string, name: string }> } };

export type GetUnreadCountQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUnreadCountQuery = { unreadNotificationsCount: number };

export type GetNotificationsQueryVariables = Exact<{
  limit?: number | null | undefined;
}>;


export type GetNotificationsQuery = { myNotifications: Array<{ __typename: 'Notification', id: string, type: NotificationType, createdAt: number, readAt: number | null, actor: { __typename: 'User', id: string, name: string }, book: { __typename: 'Book', id: string, title: string } | null }> };

export type MarkReadMutationVariables = Exact<{
  id: string | number;
}>;


export type MarkReadMutation = { markNotificationRead: { __typename: 'Notification', id: string, readAt: number | null } };

export type MarkAllReadMutationVariables = Exact<{ [key: string]: never; }>;


export type MarkAllReadMutation = { markAllNotificationsRead: number };

export type GetRecommendationsQueryVariables = Exact<{
  limit?: number | null | undefined;
}>;


export type GetRecommendationsQuery = { recommendations: Array<{ __typename: 'Recommendation', score: number, reason: string, book: { __typename: 'Book', id: string, title: string, author: string, averageRating: number, reviewsCount: number } }> };

export type GetGoalsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetGoalsQuery = { myGoals: Array<{ __typename: 'ReadingGoal', id: string, year: number, target: number, finishedCount: number, remaining: number, complete: boolean }> };

export type SetGoalMutationVariables = Exact<{
  year: number;
  target: number;
}>;


export type SetGoalMutation = { setGoal: { __typename: 'ReadingGoal', id: string, year: number, target: number, finishedCount: number, remaining: number, complete: boolean } };

export type GetStatsQueryVariables = Exact<{
  year: number;
}>;


export type GetStatsQuery = { readingStats: Array<{ __typename: 'MonthlyCount', month: number, finished: number }> };

export type SimilarBooksQueryVariables = Exact<{
  title: string;
  author?: string | null | undefined;
}>;


export type SimilarBooksQuery = { similarBooks: Array<{ __typename: 'Book', id: string, title: string, author: string }> };

export type GetChallengesQueryVariables = Exact<{
  status?: ChallengeStatus | null | undefined;
}>;


export type GetChallengesQuery = { challenges: Array<{ __typename: 'Challenge', id: string, name: string, description: string | null, startAt: number, endAt: number, target: number, status: ChallengeStatus, memberCount: number, isMember: boolean, myProgress: number }> };

export type GetChallengeQueryVariables = Exact<{
  id: string | number;
}>;


export type GetChallengeQuery = { challenge: { __typename: 'Challenge', id: string, name: string, description: string | null, startAt: number, endAt: number, target: number, status: ChallengeStatus, memberCount: number, isMember: boolean, myProgress: number, leaderboard: Array<{ __typename: 'ChallengeEntry', finished: number, percent: number, user: { __typename: 'PublicProfile', id: string, name: string } }> } | null };

export type CreateChallengeMutationVariables = Exact<{
  name: string;
  description?: string | null | undefined;
  startAt: number;
  endAt: number;
  target: number;
}>;


export type CreateChallengeMutation = { createChallenge: { __typename: 'Challenge', id: string, name: string } };

export type JoinChallengeMutationVariables = Exact<{
  id: string | number;
}>;


export type JoinChallengeMutation = { joinChallenge: { __typename: 'Challenge', id: string, isMember: boolean } };

export type LeaveChallengeMutationVariables = Exact<{
  id: string | number;
}>;


export type LeaveChallengeMutation = { leaveChallenge: boolean };

export type GetPrefsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPrefsQuery = { myNotificationPrefs: { __typename: 'NotificationPrefs', follow: boolean, like: boolean, comment: boolean } };

export type UpdateProfileMutationVariables = Exact<{
  name: string;
}>;


export type UpdateProfileMutation = { updateProfile: { __typename: 'User', id: string, name: string } };

export type ChangePasswordMutationVariables = Exact<{
  currentPassword: string;
  newPassword: string;
}>;


export type ChangePasswordMutation = { changePassword: { __typename: 'AuthPayload', token: string, refreshToken: string } };

export type SetPrefsMutationVariables = Exact<{
  follow?: boolean | null | undefined;
  like?: boolean | null | undefined;
  comment?: boolean | null | undefined;
}>;


export type SetPrefsMutation = { setNotificationPrefs: { __typename: 'NotificationPrefs', follow: boolean, like: boolean, comment: boolean } };

export type ImportBooksMutationVariables = Exact<{
  books: Array<BookImport> | BookImport;
}>;


export type ImportBooksMutation = { importBooks: { __typename: 'ImportResult', imported: number, matched: number, shelved: number, reviewed: number, errors: Array<string> } };

export type ExportDataQueryVariables = Exact<{ [key: string]: never; }>;


export type ExportDataQuery = { exportData: string };

export type ExportCsvQueryVariables = Exact<{ [key: string]: never; }>;


export type ExportCsvQuery = { exportCsv: string };

export type ToggleReviewLikeMutationVariables = Exact<{
  reviewId: string | number;
}>;


export type ToggleReviewLikeMutation = { toggleReviewLike: { __typename: 'Review', id: string, likesCount: number, likedByMe: boolean } };

export type AddCommentMutationVariables = Exact<{
  reviewId: string | number;
  text: string;
}>;


export type AddCommentMutation = { addComment: { __typename: 'ReviewComment', id: string, text: string } };

export type UpdateCommentMutationVariables = Exact<{
  id: string | number;
  text: string;
}>;


export type UpdateCommentMutation = { updateComment: { __typename: 'ReviewComment', id: string, text: string } };

export type DeleteCommentMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteCommentMutation = { deleteComment: boolean };

export type FollowUserMutationVariables = Exact<{
  userId: string | number;
}>;


export type FollowUserMutation = { followUser: { __typename: 'User', id: string, isFollowing: boolean, followersCount: number } };

export type UnfollowUserMutationVariables = Exact<{
  userId: string | number;
}>;


export type UnfollowUserMutation = { unfollowUser: boolean };

export type GetFeedQueryVariables = Exact<{
  limit?: number | null | undefined;
  offset?: number | null | undefined;
}>;


export type GetFeedQuery = { activityFeed: Array<{ __typename: 'ActivityItem', id: string, type: ActivityType, createdAt: number, shelfStatus: ShelfStatus | null, user: { __typename: 'User', id: string, name: string }, book: { __typename: 'Book', id: string, title: string, author: string }, review: { __typename: 'Review', id: string, rating: number, text: string | null } | null }> };
