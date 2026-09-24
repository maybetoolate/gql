import { gql } from "@apollo/client";

export const ADMIN_LOGIN = gql`
  mutation AdminLogin($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      refreshToken
      user {
        id
        email
        name
        role
      }
    }
  }
`;

export const ADMIN_ME = gql`
  query AdminMe {
    me {
      id
      email
      name
      role
    }
  }
`;

export const ADMIN_STATS = gql`
  query AdminStats {
    adminStats {
      userCount
      bookCount
      reviewCount
      commentCount
      shelfCount
      favoriteCount
      followCount
      tagCount
    }
  }
`;

export const ADMIN_USERS = gql`
  query AdminUsers($search: String, $limit: Int, $offset: Int) {
    users(search: $search, limit: $limit, offset: $offset) {
      id
      email
      name
      role
      followersCount
      followingCount
    }
  }
`;

export const SET_ROLE = gql`
  mutation SetRole($userId: ID!, $role: Role!) {
    setUserRole(userId: $userId, role: $role) {
      id
      role
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($userId: ID!) {
    deleteUser(userId: $userId)
  }
`;

export const ADMIN_BOOKS = gql`
  query AdminBooks($search: String, $limit: Int) {
    books(search: $search, limit: $limit, sort: NEWEST) {
      id
      title
      author
      year
      averageRating
      reviewsCount
    }
  }
`;

export const ADMIN_AUDIT = gql`
  query AdminAudit($limit: Int) {
    auditLog(limit: $limit) {
      id
      action
      targetType
      targetId
      detail
      createdAt
      actor {
        id
        email
      }
    }
  }
`;

export const ADMIN_DELETE_BOOK = gql`
  mutation AdminDeleteBook($id: ID!) {
    deleteBook(id: $id)
  }
`;

export const MERGE_BOOKS = gql`
  mutation MergeBooks($sourceId: ID!, $targetId: ID!) {
    mergeBooks(sourceId: $sourceId, targetId: $targetId) {
      id
      title
    }
  }
`;
