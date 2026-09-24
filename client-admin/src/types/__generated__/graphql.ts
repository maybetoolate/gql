/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type AuditAction =
  | 'BOOK_DELETE'
  | 'BOOK_MERGE'
  | 'ROLE_CHANGE'
  | 'USER_DELETE';

export type Role =
  | 'admin'
  | 'member';

export type AdminLoginMutationVariables = Exact<{
  email: string;
  password: string;
}>;


export type AdminLoginMutation = { login: { __typename: 'AuthPayload', token: string, refreshToken: string, user: { __typename: 'User', id: string, email: string, name: string, role: Role } } };

export type AdminMeQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminMeQuery = { me: { __typename: 'User', id: string, email: string, name: string, role: Role } | null };

export type AdminStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminStatsQuery = { adminStats: { __typename: 'AdminStats', userCount: number, bookCount: number, reviewCount: number, commentCount: number, shelfCount: number, favoriteCount: number, followCount: number, tagCount: number } };

export type AdminUsersQueryVariables = Exact<{
  search?: string | null | undefined;
  limit?: number | null | undefined;
  offset?: number | null | undefined;
}>;


export type AdminUsersQuery = { users: Array<{ __typename: 'User', id: string, email: string, name: string, role: Role, followersCount: number, followingCount: number }> };

export type SetRoleMutationVariables = Exact<{
  userId: string | number;
  role: Role;
}>;


export type SetRoleMutation = { setUserRole: { __typename: 'User', id: string, role: Role } };

export type DeleteUserMutationVariables = Exact<{
  userId: string | number;
}>;


export type DeleteUserMutation = { deleteUser: boolean };

export type AdminBooksQueryVariables = Exact<{
  search?: string | null | undefined;
  limit?: number | null | undefined;
}>;


export type AdminBooksQuery = { books: Array<{ __typename: 'Book', id: string, title: string, author: string, year: number | null, averageRating: number, reviewsCount: number }> };

export type AdminAuditQueryVariables = Exact<{
  limit?: number | null | undefined;
}>;


export type AdminAuditQuery = { auditLog: Array<{ __typename: 'AuditEntry', id: string, action: AuditAction, targetType: string, targetId: string, detail: string | null, createdAt: number, actor: { __typename: 'User', id: string, email: string } | null }> };

export type AdminDeleteBookMutationVariables = Exact<{
  id: string | number;
}>;


export type AdminDeleteBookMutation = { deleteBook: boolean };

export type MergeBooksMutationVariables = Exact<{
  sourceId: string | number;
  targetId: string | number;
}>;


export type MergeBooksMutation = { mergeBooks: { __typename: 'Book', id: string, title: string } };
