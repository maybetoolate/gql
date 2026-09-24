import DataLoader from "dataloader";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  bookTags,
  books,
  favorites,
  follows,
  reviewComments,
  reviewLikes,
  reviews,
  shelfItems,
  tags,
  users,
  type Book,
  type Review,
  type ReviewComment,
  type ShelfStatus,
  type Tag,
  type User,
} from "./db/schema";

export interface BookStats {
  averageRating: number;
  reviewsCount: number;
}

export interface ReviewLikeStats {
  likesCount: number;
  likedByMe: boolean;
}

async function batchBookStats(ids: readonly string[]): Promise<BookStats[]> {
  const list = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = await db.all<{ bookId: string; avg: number | null; n: number }>(
    sql`SELECT book_id AS bookId, avg(rating) AS avg, count(*) AS n
        FROM reviews WHERE book_id IN (${list}) GROUP BY book_id`,
  );
  const byId = new Map(rows.map((r) => [r.bookId, r]));
  return ids.map((id) => ({
    averageRating: Number(byId.get(id)?.avg ?? 0),
    reviewsCount: Number(byId.get(id)?.n ?? 0),
  }));
}

async function batchBookTags(ids: readonly string[]): Promise<Tag[][]> {
  const rows = await db
    .select({ bookId: bookTags.bookId, tag: tags })
    .from(bookTags)
    .innerJoin(tags, eq(bookTags.tagId, tags.id))
    .where(inArray(bookTags.bookId, [...ids]))
    .orderBy(tags.name);
  const byId = new Map<string, Tag[]>();
  for (const r of rows) {
    const list = byId.get(r.bookId) ?? [];
    list.push(r.tag);
    byId.set(r.bookId, list);
  }
  return ids.map((id) => byId.get(id) ?? []);
}

async function batchFavoriteMap(
  userId: string | null,
  ids: readonly string[],
): Promise<boolean[]> {
  if (!userId) return ids.map(() => false);
  const rows = await db
    .select({ bookId: favorites.bookId })
    .from(favorites)
    .where(
      and(eq(favorites.userId, userId), inArray(favorites.bookId, [...ids])),
    );
  const set = new Set(rows.map((r) => r.bookId));
  return ids.map((id) => set.has(id));
}

async function batchShelfMap(
  userId: string | null,
  ids: readonly string[],
): Promise<(ShelfStatus | null)[]> {
  if (!userId) return ids.map(() => null);
  const rows = await db
    .select({ bookId: shelfItems.bookId, status: shelfItems.status })
    .from(shelfItems)
    .where(
      and(eq(shelfItems.userId, userId), inArray(shelfItems.bookId, [...ids])),
    );
  const byId = new Map(rows.map((r) => [r.bookId, r.status as ShelfStatus]));
  return ids.map((id) => byId.get(id) ?? null);
}

async function batchReviewLikeStats(
  userId: string | null,
  ids: readonly string[],
): Promise<ReviewLikeStats[]> {
  const list = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = await db.all<{ reviewId: string; n: number; mine: number }>(
    sql`SELECT review_id AS reviewId, count(*) AS n,
          sum(CASE WHEN user_id = ${userId ?? ""} THEN 1 ELSE 0 END) AS mine
        FROM review_likes WHERE review_id IN (${list}) GROUP BY review_id`,
  );
  const byId = new Map(rows.map((r) => [r.reviewId, r]));
  return ids.map((id) => ({
    likesCount: Number(byId.get(id)?.n ?? 0),
    likedByMe: Number(byId.get(id)?.mine ?? 0) > 0,
  }));
}

export interface FollowStats {
  followersCount: number;
  followingCount: number;
}

export interface Loaders {
  bookStats: DataLoader<string, BookStats>;
  bookTags: DataLoader<string, Tag[]>;
  favoriteMap: DataLoader<string, boolean>;
  shelfMap: DataLoader<string, ShelfStatus | null>;
  reviewLikeStats: DataLoader<string, ReviewLikeStats>;
  reviewCommentCounts: DataLoader<string, number>;
  followStats: DataLoader<string, FollowStats>;
  isFollowingMap: DataLoader<string, boolean>;
  userById: DataLoader<string, User | null>;
  bookById: DataLoader<string, Book | null>;
  reviewById: DataLoader<string, Review | null>;
  commentById: DataLoader<string, ReviewComment | null>;
  followersList: DataLoader<string, User[]>;
  followingList: DataLoader<string, User[]>;
  tagBooksCount: DataLoader<string, number>;
}

async function batchFollowStats(ids: readonly string[]): Promise<FollowStats[]> {
  const list = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  const followers = await db.all<{ userId: string; n: number }>(
    sql`SELECT followee_id AS userId, count(*) AS n
        FROM follows WHERE followee_id IN (${list}) GROUP BY followee_id`,
  );
  const following = await db.all<{ userId: string; n: number }>(
    sql`SELECT follower_id AS userId, count(*) AS n
        FROM follows WHERE follower_id IN (${list}) GROUP BY follower_id`,
  );
  const erMap = new Map(followers.map((r) => [r.userId, Number(r.n)]));
  const ingMap = new Map(following.map((r) => [r.userId, Number(r.n)]));
  return ids.map((id) => ({
    followersCount: erMap.get(id) ?? 0,
    followingCount: ingMap.get(id) ?? 0,
  }));
}

async function batchIsFollowing(
  viewerId: string | null,
  ids: readonly string[],
): Promise<boolean[]> {
  if (!viewerId) return ids.map(() => false);
  const rows = await db
    .select({ followeeId: follows.followeeId })
    .from(follows)
    .where(
      and(eq(follows.followerId, viewerId), inArray(follows.followeeId, [...ids])),
    );
  const set = new Set(rows.map((r) => r.followeeId));
  return ids.map((id) => set.has(id));
}

async function batchFollowers(ids: readonly string[]): Promise<User[][]> {
  const rows = await db
    .select({ followeeId: follows.followeeId, user: users })
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(inArray(follows.followeeId, [...ids]))
    .orderBy(users.createdAt);
  const byId = new Map<string, User[]>();
  for (const r of rows) {
    const list = byId.get(r.followeeId) ?? [];
    list.push(r.user);
    byId.set(r.followeeId, list);
  }
  return ids.map((id) => byId.get(id) ?? []);
}

async function batchFollowing(ids: readonly string[]): Promise<User[][]> {
  const rows = await db
    .select({ followerId: follows.followerId, user: users })
    .from(follows)
    .innerJoin(users, eq(follows.followeeId, users.id))
    .where(inArray(follows.followerId, [...ids]))
    .orderBy(users.createdAt);
  const byId = new Map<string, User[]>();
  for (const r of rows) {
    const list = byId.get(r.followerId) ?? [];
    list.push(r.user);
    byId.set(r.followerId, list);
  }
  return ids.map((id) => byId.get(id) ?? []);
}

async function batchTagCounts(ids: readonly string[]): Promise<number[]> {
  const list = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = await db.all<{ tagId: string; n: number }>(
    sql`SELECT tag_id AS tagId, count(*) AS n
        FROM book_tags WHERE tag_id IN (${list}) GROUP BY tag_id`,
  );
  const byId = new Map(rows.map((r) => [r.tagId, Number(r.n)]));
  return ids.map((id) => byId.get(id) ?? 0);
}

async function batchCommentCounts(ids: readonly string[]): Promise<number[]> {
  const list = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = await db.all<{ reviewId: string; n: number }>(
    sql`SELECT review_id AS reviewId, count(*) AS n
        FROM review_comments WHERE review_id IN (${list}) GROUP BY review_id`,
  );
  const byId = new Map(rows.map((r) => [r.reviewId, Number(r.n)]));
  return ids.map((id) => byId.get(id) ?? 0);
}

async function batchUsers(ids: readonly string[]): Promise<(User | null)[]> {
  const rows = await db.select().from(users).where(inArray(users.id, [...ids]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id) ?? null);
}

async function batchBooks(ids: readonly string[]): Promise<(Book | null)[]> {
  const rows = await db.select().from(books).where(inArray(books.id, [...ids]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id) ?? null);
}

async function batchReviews(ids: readonly string[]): Promise<(Review | null)[]> {
  const rows = await db.select().from(reviews).where(inArray(reviews.id, [...ids]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id) ?? null);
}

async function batchComments(ids: readonly string[]): Promise<(ReviewComment | null)[]> {
  const rows = await db
    .select()
    .from(reviewComments)
    .where(inArray(reviewComments.id, [...ids]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id) ?? null);
}

/** Per-request loaders. Memoize one instance per request (see graphql.ts). */
export function createLoaders(userId: string | null): Loaders {
  return {
    bookStats: new DataLoader((ids) => batchBookStats(ids)),
    bookTags: new DataLoader((ids) => batchBookTags(ids)),
    favoriteMap: new DataLoader((ids) => batchFavoriteMap(userId, ids)),
    shelfMap: new DataLoader((ids) => batchShelfMap(userId, ids)),
    reviewLikeStats: new DataLoader((ids) => batchReviewLikeStats(userId, ids)),
    reviewCommentCounts: new DataLoader((ids) => batchCommentCounts(ids)),
    followStats: new DataLoader((ids) => batchFollowStats(ids)),
    isFollowingMap: new DataLoader((ids) => batchIsFollowing(userId, ids)),
    userById: new DataLoader((ids) => batchUsers(ids)),
    bookById: new DataLoader((ids) => batchBooks(ids)),
    reviewById: new DataLoader((ids) => batchReviews(ids)),
    commentById: new DataLoader((ids) => batchComments(ids)),
    followersList: new DataLoader((ids) => batchFollowers(ids)),
    followingList: new DataLoader((ids) => batchFollowing(ids)),
    tagBooksCount: new DataLoader((ids) => batchTagCounts(ids)),
  };
}
