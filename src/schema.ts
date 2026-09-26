import { GraphQLError } from "graphql";
import { and, count, desc, eq, gt, gte, inArray, isNull, like, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import {
  auditLog,
  books,
  bookTags,
  challengeMembers,
  challenges,
  favorites,
  follows,
  notifications,
  notificationPrefs,
  readingGoals,
  reviewComments,
  reviewLikes,
  reviews,
  shelfItems,
  tags,
  users,
  type AuditAction,
  type Book,
  type Notification as DbNotification,
  type NotificationType,
  type Role,
  type ShelfStatus,
  type Tag,
  type User,
} from "./db/schema";
import { fireAndForget, sendEmail } from "./email";
import {
  hashPassword,
  issueAuthPair,
  requestPasswordReset,
  resetPasswordWithToken,
  revokeAllSessions,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyPassword,
} from "./auth";
import { deleteCoverForBook } from "./covers";
import type { Loaders } from "./loaders";

export interface GraphQLContext {
  user: User | null;
  loaders: Loaders;
}

const SHELF_STATUSES: ShelfStatus[] = ["want_to_read", "reading", "finished"];

function requireUser(ctx: GraphQLContext): User {
  if (!ctx.user) {
    throw new GraphQLError("Authentication required", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return ctx.user;
}

function requireAdmin(ctx: GraphQLContext): User {
  const user = requireUser(ctx);
  if (user.role !== "admin") {
    throw new GraphQLError("Admin access required", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return user;
}

function badInput(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

async function audit(
  actorId: string,
  action: AuditAction,
  targetType: string,
  targetId: string,
  detail?: string | null,
): Promise<void> {
  await db.insert(auditLog).values({
    actorId,
    action,
    targetType,
    targetId,
    detail: detail ?? null,
  });
}

function toPublicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}

export const typeDefs = `#graphql
  enum ShelfStatus {
    want_to_read
    reading
    finished
  }

  enum Role {
    admin
    member
  }

  enum BookSort {
    NEWEST
    TITLE
    AUTHOR
    RATING
  }

  enum ReviewSort {
    NEWEST
    TOP
  }

  enum NotificationType {
    FOLLOW
    REVIEW_LIKE
    REVIEW_COMMENT
  }

  type Notification {
    id: ID!
    type: NotificationType!
    createdAt: Float!
    readAt: Float
    actor: User!
    book: Book
    review: Review
    comment: ReviewComment
  }

  type NotificationPrefs {
    follow: Boolean!
    like: Boolean!
    comment: Boolean!
  }

  type Recommendation {
    book: Book!
    score: Float!
    reason: String!
  }

  type ReadingGoal {
    id: ID!
    year: Int!
    target: Int!
    finishedCount: Int!
    remaining: Int!
    complete: Boolean!
  }

  type MonthlyCount {
    month: Int!
    finished: Int!
  }

  enum ChallengeStatus {
    UPCOMING
    ACTIVE
    ENDED
  }

  type ChallengeEntry {
    user: PublicProfile!
    finished: Int!
    percent: Int!
  }

  type PublicProfile {
    id: ID!
    name: String!
  }

  type Challenge {
    id: ID!
    name: String!
    description: String
    startAt: Float!
    endAt: Float!
    target: Int!
    status: ChallengeStatus!
    memberCount: Int!
    isMember: Boolean!
    myProgress: Int!
    leaderboard(limit: Int = 20): [ChallengeEntry!]!
  }

  type BookEdge {
    cursor: String!
    node: Book!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }
  type BookConnection {
    totalCount: Int!
    edges: [BookEdge!]!
    pageInfo: PageInfo!
  }

  enum AuditAction {
    USER_DELETE
    ROLE_CHANGE
    BOOK_DELETE
    BOOK_MERGE
  }

  type AuditEntry {
    id: ID!
    action: AuditAction!
    targetType: String!
    targetId: ID!
    detail: String
    createdAt: Float!
    actor: User
  }

  input BookImport {
    title: String!
    author: String!
    year: Int
    description: String
    shelf: ShelfStatus
    rating: Int
    reviewText: String
  }

  type ImportResult {
    imported: Int!
    matched: Int!
    shelved: Int!
    reviewed: Int!
    errors: [String!]!
  }

  type Tag {
    id: ID!
    name: String!
    booksCount: Int!
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: Role!
    createdAt: Float!
    followersCount: Int!
    followingCount: Int!
    isFollowing: Boolean!
  }

  type AdminStats {
    userCount: Int!
    bookCount: Int!
    reviewCount: Int!
    commentCount: Int!
    shelfCount: Int!
    favoriteCount: Int!
    followCount: Int!
    tagCount: Int!
  }

  type AuthPayload {
    token: String!
    refreshToken: String!
    user: User!
  }

  type Book {
    id: ID!
    title: String!
    author: String!
    year: Int
    description: String
    coverUrl: String
    createdBy: ID
    createdAt: Float!    averageRating: Float!
    reviewsCount: Int!
    isFavorite: Boolean!
    shelfStatus: ShelfStatus
    tags: [Tag!]!
    reviews(limit: Int = 20, offset: Int = 0, sort: ReviewSort = NEWEST): [Review!]!
  }

  type ShelfItem {
    id: ID!
    status: ShelfStatus!
    progress: Int!
    updatedAt: Float!
    book: Book!
  }

  type Review {
    id: ID!
    rating: Int!
    text: String
    likesCount: Int!
    likedByMe: Boolean!
    commentsCount: Int!
    createdAt: Float!
    updatedAt: Float!
    user: User!
    book: Book!
    comments(limit: Int = 20, offset: Int = 0): [ReviewComment!]!
  }

  type ReviewComment {
    id: ID!
    text: String!
    createdAt: Float!
    updatedAt: Float!
    user: User!
    review: Review!
  }

  enum ActivityType {
    REVIEW
    SHELF_UPDATE
    FAVORITE
  }

  type ActivityItem {
    id: ID!
    type: ActivityType!
    createdAt: Float!
    user: User!
    book: Book!
    review: Review
    shelfStatus: ShelfStatus
  }

  type Query {
    hello: String!
    me: User
    books(
      search: String
      tag: String
      tags: [String!]
      sort: BookSort = NEWEST
      limit: Int = 20
      offset: Int = 0
    ): [Book!]!
    book(id: ID!): Book
    booksCount(search: String, tag: String, tags: [String!]): Int!
    tags(limit: Int = 50): [Tag!]!
    myShelf(status: ShelfStatus): [ShelfItem!]!
    myFavorites: [Book!]!
    bookReviews(
      bookId: ID!
      limit: Int = 20
      offset: Int = 0
      sort: ReviewSort = NEWEST
    ): [Review!]!
    myReviews: [Review!]!
    followers(userId: ID!): [User!]!
    following(userId: ID!): [User!]!
    activityFeed(limit: Int = 20, offset: Int = 0): [ActivityItem!]!
    adminStats: AdminStats!
    users(search: String, limit: Int = 20, offset: Int = 0): [User!]!
    user(id: ID!): User
    auditLog(limit: Int = 50, offset: Int = 0): [AuditEntry!]!
    myNotifications(limit: Int = 20, offset: Int = 0, unreadOnly: Boolean = false): [Notification!]!
    unreadNotificationsCount: Int!
    myNotificationPrefs: NotificationPrefs!
    recommendations(limit: Int = 10): [Recommendation!]!
    myGoals: [ReadingGoal!]!
    goal(year: Int!): ReadingGoal
    exportData: String!
    exportCsv: String!
    similarBooks(title: String!, author: String, limit: Int = 5): [Book!]!
    readingStats(year: Int!): [MonthlyCount!]!
    challenges(status: ChallengeStatus, limit: Int = 20, offset: Int = 0): [Challenge!]!
    challenge(id: ID!): Challenge
    booksConnection(
      first: Int = 20
      after: String
      search: String
      tag: String
      tags: [String!]
      sort: BookSort = NEWEST
    ): BookConnection!
  }

  type Mutation {
    register(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    refreshToken(token: String!): AuthPayload!
    logout(token: String!): Boolean!
    logoutAll: Boolean!
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): AuthPayload!
    addBook(
      title: String!
      author: String!
      year: Int
      description: String
      coverUrl: String
    ): Book!
    updateBook(
      id: ID!
      title: String
      author: String
      year: Int
      description: String
      coverUrl: String
    ): Book!
    deleteBook(id: ID!): Boolean!
    setShelfStatus(bookId: ID!, status: ShelfStatus!): ShelfItem!
    updateShelfProgress(bookId: ID!, progress: Int!): ShelfItem!
    removeFromShelf(bookId: ID!): Boolean!
    toggleFavorite(bookId: ID!): Book!
    toggleReviewLike(reviewId: ID!): Review!
    addComment(reviewId: ID!, text: String!): ReviewComment!
    updateComment(id: ID!, text: String!): ReviewComment!
    deleteComment(id: ID!): Boolean!
    followUser(userId: ID!): User!
    unfollowUser(userId: ID!): Boolean!
    setUserRole(userId: ID!, role: Role!): User!
    deleteUser(userId: ID!): Boolean!
    mergeBooks(sourceId: ID!, targetId: ID!): Book!
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Int!
    updateProfile(name: String!): User!
    changePassword(currentPassword: String!, newPassword: String!): AuthPayload!
    setNotificationPrefs(follow: Boolean, like: Boolean, comment: Boolean): NotificationPrefs!
    setGoal(year: Int!, target: Int!): ReadingGoal!
    deleteGoal(year: Int!): Boolean!
    importBooks(books: [BookImport!]!): ImportResult!
    createChallenge(
      name: String!
      description: String
      startAt: Float!
      endAt: Float!
      target: Int!
    ): Challenge!
    joinChallenge(id: ID!): Challenge!
    leaveChallenge(id: ID!): Boolean!
    deleteChallenge(id: ID!): Boolean!
    addTagToBook(bookId: ID!, name: String!): Book!
    removeTagFromBook(bookId: ID!, name: String!): Book!
    upsertReview(bookId: ID!, rating: Int!, text: String): Review!
    deleteReview(id: ID!): Boolean!
  }
`;

export async function getBookOrThrow(id: string): Promise<Book> {  const rows = await db.select().from(books).where(eq(books.id, id));
  const book = rows[0];
  if (!book) {
    throw new GraphQLError("Book not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return book;
}

export function canEdit(book: Book, user: User): boolean {
  return !book.createdBy || book.createdBy === user.id;
}

function assertCanEdit(book: Book, user: User, action: string) {
  if (!canEdit(book, user)) {
    throw new GraphQLError(`Only the creator can ${action}`, {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function getReviewOrThrow(id: string) {
  const rows = await db.select().from(reviews).where(eq(reviews.id, id));
  const review = rows[0];
  if (!review) {
    throw new GraphQLError("Review not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return review;
}

async function getUserOrThrow(id: string): Promise<User> {
  const rows = await db.select().from(users).where(eq(users.id, id));
  const user = rows[0];
  if (!user) {
    throw new GraphQLError("User not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return user;
}

type ActivityType = "REVIEW" | "SHELF_UPDATE" | "FAVORITE";

interface Recommendation {
  book: Book;
  score: number;
  reason: string;
}

async function buildRecommendations(userId: string, limit: number): Promise<Recommendation[]> {
  const [shelfRows, revRows, favRows] = await Promise.all([
    db.select({ bookId: shelfItems.bookId }).from(shelfItems).where(eq(shelfItems.userId, userId)),
    db.select().from(reviews).where(eq(reviews.userId, userId)),
    db.select({ bookId: favorites.bookId }).from(favorites).where(eq(favorites.userId, userId)),
  ]);
  const known = new Set([
    ...shelfRows.map((r) => r.bookId),
    ...revRows.map((r) => r.bookId),
    ...favRows.map((r) => r.bookId),
  ]);
  const likedIds = new Set([
    ...shelfRows.length
      ? (
          await db
            .select({ bookId: shelfItems.bookId })
            .from(shelfItems)
            .where(
              and(eq(shelfItems.userId, userId), eq(shelfItems.status, "finished")),
            )
        ).map((r) => r.bookId)
      : [],
    ...revRows.filter((r) => r.rating >= 4).map((r) => r.bookId),
  ]);

  const picked = new Map<string, Recommendation>();
  const take = (id: string, entry: Omit<Recommendation, "book">) => {
    if (known.has(id) || picked.has(id)) return;
    picked.set(id, entry as Recommendation);
  };

  // 1. Social: 4–5★ reviews by followed users (most recent first).
  const followRows = await db
    .select({ followeeId: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, userId));
  const followeeIds = followRows.map((r) => r.followeeId);
  if (followeeIds.length > 0) {
    const social = await db
      .select({
        bookId: reviews.bookId,
        rating: reviews.rating,
        name: users.name,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(and(inArray(reviews.userId, followeeIds), gte(reviews.rating, 4)))
      .orderBy(desc(reviews.createdAt))
      .limit(50);
    for (const s of social) {
      take(s.bookId, {
        score: 3 + s.rating / 10,
        reason: `Rated ${s.rating}★ by ${s.name}`,
      });
    }
  }

  // 2. Content: tag overlap with books the viewer finished or rated 4★+.
  if (likedIds.size > 0) {
    const likedList = sql.join(
      [...likedIds].map((id) => sql`${id}`),
      sql`, `,
    );
    const tagRows = await db.all<{ tagId: string; name: string }>(
      sql`SELECT DISTINCT tg.id AS tagId, tg.name AS name
          FROM book_tags bt JOIN tags tg ON tg.id = bt.tag_id
          WHERE bt.book_id IN (${likedList})`,
    );
    const tagNames = new Map(tagRows.map((t) => [t.tagId, t.name]));
    if (tagRows.length > 0) {
      const idList = sql.join(
        tagRows.map((t) => sql`${t.tagId}`),
        sql`, `,
      );
      const overlap = await db.all<{ bookId: string; tagId: string }>(
        sql`SELECT bt.book_id AS bookId, bt.tag_id AS tagId
            FROM book_tags bt WHERE bt.tag_id IN (${idList})`,
      );
      const shared = new Map<string, Set<string>>();
      for (const o of overlap) {
        if (known.has(o.bookId)) continue;
        const set = shared.get(o.bookId) ?? new Set<string>();
        set.add(o.tagId);
        shared.set(o.bookId, set);
      }
      const ranked = [...shared.entries()]
        .map(([bookId, set]) => ({
          bookId,
          names: [...set].map((id) => tagNames.get(id) ?? id).sort(),
        }))
        .sort((a, b) => b.names.length - a.names.length || a.bookId.localeCompare(b.bookId))
        .slice(0, 50);
      for (const r of ranked) {
        take(r.bookId, {
          score: 2 + Math.min(r.names.length, 5) / 10,
          reason: `Shares ${r.names.length === 1 ? "tag" : "tags"} ${r.names.slice(0, 2).map((n) => `#${n}`).join(" ")} with books you love`,
        });
      }
    }
  }

  // 3. Global fallback: top-rated books.
  const top = await db.all<{ id: string; avg: number | null; n: number }>(
    sql`SELECT b.id AS id, avg(r.rating) AS avg, count(r.id) AS n
        FROM books b LEFT JOIN reviews r ON r.book_id = b.id
        GROUP BY b.id HAVING n > 0 ORDER BY avg DESC, n DESC LIMIT 20`,
  );
  for (const t of top) {
    const avg = Number(t.avg ?? 0);
    take(t.id, { score: 1 + avg / 10, reason: `Top rated ★${avg.toFixed(1)}` });
  }

  const ids = [...picked.keys()].slice(0, limit);
  if (ids.length === 0) return [];
  const rows = await db.select().from(books).where(inArray(books.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const book = byId.get(id);
    const entry = picked.get(id);
    return book && entry ? [{ book, score: entry.score, reason: entry.reason }] : [];
  });
}

interface FeedItem {
  id: string;
  type: ActivityType;
  createdAt: number;
  userId: string;
  bookId: string;
  reviewId: string | null;
  shelfStatus: ShelfStatus | null;
}

function validateCommentText(text: string): string {
  const t = text.trim();
  if (!t) throw badInput("Comment text is required");
  if (t.length > 2000) throw badInput("Comment too long (max 2000)");
  return t;
}

function validateTagName(name: string): string {
  const n = normalizeTagName(name);
  if (!n) throw badInput("Tag name is required");
  if (n.length > 30) throw badInput("Tag name too long (max 30)");
  if (!/^[a-z0-9][a-z0-9 \-]*$/.test(n)) {
    throw badInput("Tag may only contain letters, numbers, spaces, hyphens");
  }
  return n;
}

interface NotifyInput {
  userId: string;
  actorId: string;
  type: NotificationType;
  reviewId?: string | null;
  commentId?: string | null;
  bookId?: string | null;
}

const PREF_COLUMN: Record<NotificationType, "follow" | "like" | "comment"> = {
  FOLLOW: "follow",
  REVIEW_LIKE: "like",
  REVIEW_COMMENT: "comment",
};

async function prefsEnabled(userId: string, type: NotificationType): Promise<boolean> {
  const rows = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, userId));
  if (!rows[0]) return true;
  return rows[0][PREF_COLUMN[type]] !== 0;
}

function toPrefsPayload(row: { follow: number; like: number; comment: number } | null | undefined) {
  return {
    follow: (row?.follow ?? 1) !== 0,
    like: (row?.like ?? 1) !== 0,
    comment: (row?.comment ?? 1) !== 0,
  };
}

async function notify(input: NotifyInput): Promise<DbNotification | null> {
  if (input.userId === input.actorId) return null;
  if (!(await prefsEnabled(input.userId, input.type))) return null;
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      actorId: input.actorId,
      type: input.type,
      reviewId: input.reviewId ?? null,
      commentId: input.commentId ?? null,
      bookId: input.bookId ?? null,
    })
    .returning();

  fireAndForget(
    (async () => {
      const [recipient, actor] = await Promise.all([
        getUserOrThrow(input.userId).catch(() => null),
        getUserOrThrow(input.actorId).catch(() => null),
      ]);
      if (!recipient || !actor) return;
      let subject = "";
      if (input.type === "FOLLOW") subject = `${actor.name} started following you`;
      else {
        const book = input.bookId ? await getBookOrThrow(input.bookId).catch(() => null) : null;
        const title = book ? ` of ${book.title}` : "";
        subject =
          input.type === "REVIEW_LIKE"
            ? `${actor.name} liked your review${title}`
            : `${actor.name} commented on your review${title}`;
      }
      await sendEmail({ to: recipient.email, subject, body: subject });
    })(),
  );
  return row;
}

async function retractUnread(input: {
  userId: string;
  actorId: string;
  type: NotificationType;
  reviewId?: string | null;
}): Promise<void> {
  const conds = [
    eq(notifications.userId, input.userId),
    eq(notifications.actorId, input.actorId),
    eq(notifications.type, input.type),
    isNull(notifications.readAt),
  ];
  if (input.reviewId) conds.push(eq(notifications.reviewId, input.reviewId));
  await db.delete(notifications).where(and(...conds));
}

export async function linkTagToBook(bookId: string, rawName: string) {
  const name = validateTagName(rawName);
  let tag = (await db.select().from(tags).where(eq(tags.name, name)))[0];
  if (!tag) {
    [tag] = await db.insert(tags).values({ name }).returning();
  }
  await db
    .insert(bookTags)
    .values({ bookId, tagId: tag.id })
    .onConflictDoNothing()
    .returning();
  return tag;
}

/** Build an FTS5 prefix query (`"dun"*`) from free text, or null if empty. */
function buildFtsQuery(search: string): string | null {
  const tokens = search
    .split(/\s+/)
    .map((t) => t.replace(/"/g, "").trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

const BOOK_COLUMNS = sql`
  b.id AS id, b.title AS title, b.author AS author, b.year AS year,
  b.description AS description, b.cover_url AS coverUrl,
  b.created_by AS createdBy, b.created_at AS createdAt
`;

type BookSort = "NEWEST" | "TITLE" | "AUTHOR" | "RATING";

interface ListBooksArgs {
  search?: string | null;
  tag?: string | null;
  tags?: string[] | null;
  sort?: BookSort | null;
  limit?: number | null;
  offset?: number | null;
}

interface BookFilters {
  search?: string | null;
  tag?: string | null;
  tags?: string[] | null;
}

function encodeCursor(parts: (string | number | null)[]): string {
  return Buffer.from(JSON.stringify(parts)).toString("base64url");
}

function decodeCursor(cursor: string, sort: BookSort): (string | number | null)[] {
  try {
    const parts = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as unknown;
    if (!Array.isArray(parts)) throw new Error();
    const want = sort === "AUTHOR" || sort === "RATING" ? 3 : 2;
    if (parts.length !== want || parts.some((p) => typeof p !== "string" && typeof p !== "number" && p !== null)) {
      throw new Error();
    }
    if (sort !== "RATING" && parts.some((p) => p === null)) throw new Error();
    if (sort === "RATING") {
      if (parts[0] !== null && typeof parts[0] !== "number") throw new Error();
      if (typeof parts[1] !== "number" || typeof parts[2] !== "string") throw new Error();
    }
    return parts as (string | number | null)[];
  } catch {
    throw badInput("Invalid cursor");
  }
}

interface ListBooksArgs extends BookFilters {
  sort?: BookSort | null;
  limit?: number | null;
  offset?: number | null;
}

interface ConnectionArgs extends BookFilters {
  first?: number | null;
  after?: string | null;
  sort?: BookSort | null;
}

async function listBooksConnection(
  args: ConnectionArgs,
  allowFts = true,
): Promise<{ totalCount: number; edges: { cursor: string; node: Book }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }> {
  const first = Math.min(Math.max(args.first ?? 20, 1), 50);
  const sort: BookSort = args.sort ?? "NEWEST";
  const totalCount = await countBooks(args, allowFts);

  let keyset: SQL | null = null;
  let having: SQL | null = null;
  let order: SQL;
  if (args.after) {
    const parts = decodeCursor(args.after, sort);
    if (sort === "NEWEST") {
      const [ts, cid] = parts as [number, string];
      keyset = sql`(b.created_at < ${ts} OR (b.created_at = ${ts} AND b.id < ${cid}))`;
      order = sql`ORDER BY b.created_at DESC, b.id DESC`;
    } else if (sort === "TITLE") {
      const [title, cid] = parts as [string, string];
      keyset = sql`(b.title > ${title} COLLATE NOCASE OR (b.title = ${title} COLLATE NOCASE AND b.id > ${cid}))`;
      order = sql`ORDER BY b.title COLLATE NOCASE ASC, b.id ASC`;
    } else if (sort === "AUTHOR") {
      const [author, title, cid] = parts as [string, string, string];
      keyset = sql`(b.author > ${author} COLLATE NOCASE OR (b.author = ${author} COLLATE NOCASE AND (b.title > ${title} COLLATE NOCASE OR (b.title = ${title} COLLATE NOCASE AND b.id > ${cid}))))`;
      order = sql`ORDER BY b.author COLLATE NOCASE ASC, b.title COLLATE NOCASE ASC, b.id ASC`;
    } else {
      const [avg, ts, cid] = parts as [number | null, number, string];
      const afterKey = sql`(b.created_at < ${ts} OR (b.created_at = ${ts} AND b.id < ${cid}))`;
      having =
        avg === null
          ? sql`HAVING _avg IS NULL AND (${afterKey})`
          : sql`HAVING _avg < ${avg} OR (_avg = ${avg} AND (${afterKey})) OR _avg IS NULL`;
      order = sql`ORDER BY _avg IS NULL, _avg DESC, b.created_at DESC, b.id DESC`;
    }
  } else {
    order =
      sort === "TITLE"
        ? sql`ORDER BY b.title COLLATE NOCASE ASC, b.id ASC`
        : sort === "AUTHOR"
          ? sql`ORDER BY b.author COLLATE NOCASE ASC, b.title COLLATE NOCASE ASC, b.id ASC`
          : sort === "RATING"
            ? sql`ORDER BY _avg IS NULL, _avg DESC, b.created_at DESC, b.id DESC`
            : sql`ORDER BY b.created_at DESC, b.id DESC`;
  }

  try {
    let rows: (Book & { _avg?: number | null })[];
    if (sort === "RATING") {
      const { where, fts } = bookFilterWhere(args, allowFts);
      void fts;
      rows = await db.all(sql<(Book & { _avg?: number | null })[]>`
        SELECT ${BOOK_COLUMNS}, avg(r.rating) AS _avg FROM books b
        LEFT JOIN reviews r ON r.book_id = b.id
        ${where}
        GROUP BY b.id
        ${having ?? sql``}
        ${order}
        LIMIT ${first + 1}
      `);
    } else {
      const { where } = bookFilterWhere(args, allowFts, keyset ? [keyset] : []);
      rows = await db.all(sql<Book[]>`
        SELECT ${BOOK_COLUMNS} FROM books b
        ${where}
        ${order}
        LIMIT ${first + 1}
      `);
    }

    const page = rows.slice(0, first);
    const edges = page.map((row) => {
      const cursor =
        sort === "NEWEST"
          ? encodeCursor([row.createdAt, row.id])
          : sort === "TITLE"
            ? encodeCursor([row.title, row.id])
            : sort === "AUTHOR"
              ? encodeCursor([row.author, row.title, row.id])
              : encodeCursor([row._avg ?? null, row.createdAt, row.id]);
      const { _avg: _omit, ...node } = row as Book & { _avg?: number | null };
      void _omit;
      return { cursor, node: node as Book };
    });
    return {
      totalCount,
      edges,
      pageInfo: {
        hasNextPage: rows.length > first,
        endCursor: edges.length > 0 ? edges[edges.length - 1]!.cursor : null,
      },
    };
  } catch (err) {
    if (allowFts) {
      // FTS syntax errors fall back to LIKE search (re-runs count too).
      return listBooksConnection({ ...args, search: undefined }, false);
    }
    throw err;
  }
}

function bookFilterWhere(
  args: BookFilters,
  allowFts: boolean,
  extra: SQL[] = [],
): { where: SQL; fts: string | null } {
  const tagNames = [...(args.tag ? [args.tag] : []), ...(args.tags ?? [])]
    .map(normalizeTagName)
    .filter(Boolean);
  const uniqueTags = [...new Set(tagNames)];

  const conds: SQL[] = [];
  const q = args.search?.trim();
  const fts = allowFts && q ? buildFtsQuery(q) : null;
  if (fts) {
    conds.push(sql`b.id IN (SELECT book_id FROM books_fts WHERE books_fts MATCH ${fts})`);
  } else if (q) {
    conds.push(
      sql`(b.title LIKE ${`%${q}%`} OR b.author LIKE ${`%${q}%`} OR b.description LIKE ${`%${q}%`})`,
    );
  }
  for (const t of uniqueTags) {
    conds.push(sql`EXISTS (
      SELECT 1 FROM book_tags bt
      JOIN tags tg ON tg.id = bt.tag_id
      WHERE bt.book_id = b.id AND tg.name = ${t}
    )`);
  }
  conds.push(...extra);
  return {
    where: conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``,
    fts,
  };
}

type ChallengeStatus = "UPCOMING" | "ACTIVE" | "ENDED";

/** Classify a challenge using its start and end timestamps. */
function challengeStatusOf(row: { startAt: number; endAt: number }): ChallengeStatus {
  const now = Date.now();
  if (now < row.startAt) return "UPCOMING";
  if (now > row.endAt) return "ENDED";
  return "ACTIVE";
}

/** Count a user's finished shelf items updated within a challenge's inclusive window. */
async function finishedInWindow(
  userId: string,
  startAt: number,
  endAt: number,
): Promise<number> {
  const rows = await db.all<{ n: number }>(
    sql`SELECT count(*) AS n FROM shelf_items
        WHERE user_id = ${userId} AND status = 'finished'
          AND finished_at >= ${startAt} AND finished_at <= ${endAt}`,
  );
  return Number(rows[0]?.n ?? 0);
}

/** Fetch a challenge or report a GraphQL not-found error. */
async function getChallengeOrThrow(id: string) {
  const rows = await db.select().from(challenges).where(eq(challenges.id, id));
  const row = rows[0];
  if (!row) {
    throw new GraphQLError("Challenge not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return row;
}

/** Add a user's finished-book count and remaining target to a reading goal. */
async function goalWithProgress(
  userId: string,
  row: typeof readingGoals.$inferSelect,
) {
  const finished = await db
    .select({ n: count() })
    .from(shelfItems)
    .where(
      and(eq(shelfItems.userId, userId), eq(shelfItems.status, "finished")),
    );
  const finishedCount = Number(finished[0]?.n ?? 0);
  return {
    id: row.id,
    year: row.year,
    target: row.target,
    finishedCount,
    remaining: Math.max(0, row.target - finishedCount),
    complete: finishedCount >= row.target,
  };
}

async function countBooks(args: BookFilters, allowFts = true): Promise<number> {
  const { where, fts } = bookFilterWhere(args, allowFts);
  try {
    const rows = await db.all<{ n: number }>(
      sql`SELECT count(DISTINCT b.id) AS n FROM books b ${where}`,
    );
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    // FTS syntax errors fall back to LIKE search.
    if (allowFts && fts) return countBooks(args, false);
    throw err;
  }
}

async function listBooks(args: ListBooksArgs, allowFts = true): Promise<Book[]> {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
  const offset = Math.max(args.offset ?? 0, 0);
  const sort: BookSort = args.sort ?? "NEWEST";
  const { where, fts } = bookFilterWhere(args, allowFts);

  try {
    if (sort === "RATING") {
      return await db.all(sql<Book[]>`
        SELECT ${BOOK_COLUMNS} FROM books b
        LEFT JOIN reviews r ON r.book_id = b.id
        ${where}
        GROUP BY b.id
        ORDER BY avg(r.rating) IS NULL, avg(r.rating) DESC, b.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
    }
    const order =
      sort === "TITLE"
        ? sql`ORDER BY b.title COLLATE NOCASE ASC`
        : sort === "AUTHOR"
          ? sql`ORDER BY b.author COLLATE NOCASE ASC, b.title COLLATE NOCASE ASC`
          : sql`ORDER BY b.created_at DESC`;
    return await db.all(sql<Book[]>`
      SELECT ${BOOK_COLUMNS} FROM books b
      ${where}
      ${order}
      LIMIT ${limit} OFFSET ${offset}
    `);
  } catch (err) {
    // FTS syntax errors fall back to LIKE search.
    if (allowFts && fts) return listBooks(args, false);
    throw err;
  }
}

interface ListReviewsArgs {
  limit?: number | null;
  offset?: number | null;
  sort?: "NEWEST" | "TOP" | null;
}

async function listReviews(bookId: string, args: ListReviewsArgs) {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
  const offset = Math.max(args.offset ?? 0, 0);
  if ((args.sort ?? "NEWEST") === "TOP") {
    return db.all(sql<typeof reviews.$inferSelect[]>`
      SELECT rv.id AS id, rv.user_id AS userId, rv.book_id AS bookId,
        rv.rating AS rating, rv.text AS text,
        rv.created_at AS createdAt, rv.updated_at AS updatedAt
      FROM reviews rv
      LEFT JOIN review_likes rl ON rl.review_id = rv.id
      WHERE rv.book_id = ${bookId}
      GROUP BY rv.id
      ORDER BY count(rl.id) DESC, rv.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  }
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.bookId, bookId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);
}

export const resolvers = {
  Query: {
    hello: () => "Hello from Apollo Server + Hono!",
    me: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return toPublicUser(user);
    },
    books: ( _: unknown, args: ListBooksArgs ): Promise<Book[]> => listBooks(args),
    booksCount: (
      _: unknown,
      args: BookFilters,
    ): Promise<number> => countBooks(args),
    booksConnection: (_: unknown, args: ConnectionArgs) =>
      listBooksConnection(args),
    similarBooks: async (
      _: unknown,
      args: { title: string; author?: string | null; limit?: number | null },
    ): Promise<Book[]> => {
      const title = args.title.trim();
      if (!title) return [];
      const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);
      const byTitle = await listBooks(
        { search: title, limit, sort: "NEWEST" },
        true,
      );
      const author = args.author?.trim().toLowerCase();
      const ranked = byTitle
        .map((b) => ({
          book: b,
          score:
            (author && b.author.toLowerCase() === author ? 2 : 0) +
            (b.title.toLowerCase() === title.toLowerCase() ? 1 : 0),
        }))
        .sort((a, b) => b.score - a.score || b.book.createdAt - a.book.createdAt);
      return ranked.slice(0, limit).map((r) => r.book);
    },
    book: async (_: unknown, args: { id: string }): Promise<Book | null> => {
      const rows = await db.select().from(books).where(eq(books.id, args.id));
      return rows[0] ?? null;
    },
    tags: async (
      _: unknown,
      args: { limit?: number | null },
    ): Promise<Tag[]> => {
      const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
      return db.select().from(tags).orderBy(tags.name).limit(limit);
    },
    myShelf: async (
      _: unknown,
      args: { status?: ShelfStatus | null },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const cond =
        args.status != null
          ? and(eq(shelfItems.userId, user.id), eq(shelfItems.status, args.status))
          : eq(shelfItems.userId, user.id);
      return db
        .select()
        .from(shelfItems)
        .where(cond)
        .orderBy(desc(shelfItems.updatedAt));
    },
    myFavorites: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return db
        .select({ book: books })
        .from(favorites)
        .innerJoin(books, eq(favorites.bookId, books.id))
        .where(eq(favorites.userId, user.id))
        .orderBy(desc(favorites.createdAt))
        .then((rows) => rows.map((r) => r.book));
    },
    bookReviews: (
      _: unknown,
      args: { bookId: string } & ListReviewsArgs,
    ) => listReviews(args.bookId, args),
    myReviews: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return db
        .select()
        .from(reviews)
        .where(eq(reviews.userId, user.id))
        .orderBy(desc(reviews.createdAt));
    },
    followers: async (_: unknown, args: { userId: string }, ctx: GraphQLContext) => {
      await getUserOrThrow(args.userId);
      const rows = await ctx.loaders.followersList.load(args.userId);
      return rows.map(toPublicUser);
    },
    following: async (_: unknown, args: { userId: string }, ctx: GraphQLContext) => {
      await getUserOrThrow(args.userId);
      const rows = await ctx.loaders.followingList.load(args.userId);
      return rows.map(toPublicUser);
    },
    activityFeed: async (
      _: unknown,
      args: { limit?: number | null; offset?: number | null },
      ctx: GraphQLContext,
    ): Promise<FeedItem[]> => {      const user = requireUser(ctx);
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
      const offset = Math.max(args.offset ?? 0, 0);
      const edges = await db
        .select({ followeeId: follows.followeeId })
        .from(follows)
        .where(eq(follows.followerId, user.id));
      const ids = edges.map((e) => e.followeeId);
      if (ids.length === 0) return [];

      const [revRows, shelfRows, favRows] = await Promise.all([
        db
          .select()
          .from(reviews)
          .where(inArray(reviews.userId, ids))
          .orderBy(desc(reviews.createdAt))
          .limit(limit + offset),
        db
          .select()
          .from(shelfItems)
          .where(inArray(shelfItems.userId, ids))
          .orderBy(desc(shelfItems.updatedAt))
          .limit(limit + offset),
        db
          .select()
          .from(favorites)
          .where(inArray(favorites.userId, ids))
          .orderBy(desc(favorites.createdAt))
          .limit(limit + offset),
      ]);

      const items: FeedItem[] = [
        ...revRows.map((r): FeedItem => ({
          id: `review:${r.id}`,
          type: "REVIEW",
          createdAt: r.createdAt,
          userId: r.userId,
          bookId: r.bookId,
          reviewId: r.id,
          shelfStatus: null,
        })),
        ...shelfRows.map((s): FeedItem => ({
          id: `shelf:${s.id}`,
          type: "SHELF_UPDATE",
          createdAt: s.updatedAt,
          userId: s.userId,
          bookId: s.bookId,
          reviewId: null,
          shelfStatus: s.status as ShelfStatus,
        })),
        ...favRows.map((f): FeedItem => ({
          id: `favorite:${f.id}`,
          type: "FAVORITE",
          createdAt: f.createdAt,
          userId: f.userId,
          bookId: f.bookId,
          reviewId: null,
          shelfStatus: null,
        })),
      ];
      items.sort((a, b) => b.createdAt - a.createdAt);
      return items.slice(offset, offset + limit);
    },
    adminStats: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAdmin(ctx);
      const counter = async (
        table:
          | typeof users
          | typeof books
          | typeof reviews
          | typeof reviewComments
          | typeof shelfItems
          | typeof favorites
          | typeof follows
          | typeof tags,
      ): Promise<number> => {
        const rows = await db.select({ n: count() }).from(table);
        return Number(rows[0]?.n ?? 0);
      };
      const [userCount, bookCount, reviewCount, commentCount, shelfCount, favoriteCount, followCount, tagCount] =
        await Promise.all([
          counter(users),
          counter(books),
          counter(reviews),
          counter(reviewComments),
          counter(shelfItems),
          counter(favorites),
          counter(follows),
          counter(tags),
        ]);
      return { userCount, bookCount, reviewCount, commentCount, shelfCount, favoriteCount, followCount, tagCount };
    },
    users: async (
      _: unknown,
      args: { search?: string | null; limit?: number | null; offset?: number | null },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
      const offset = Math.max(args.offset ?? 0, 0);
      const q = args.search?.trim();
      const rows = await db
        .select()
        .from(users)
        .where(
          q
            ? or(like(users.email, `%${q}%`), like(users.name, `%${q}%`))
            : undefined,
        )
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
      return rows.map(toPublicUser);
    },
    user: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAdmin(ctx);
      const rows = await db.select().from(users).where(eq(users.id, args.id));
      return rows[0] ? toPublicUser(rows[0]) : null;
    },
    auditLog: async (
      _: unknown,
      args: { limit?: number | null; offset?: number | null },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
      const offset = Math.max(args.offset ?? 0, 0);
      return db
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset);
    },
    myNotifications: async (
      _: unknown,
      args: { limit?: number | null; offset?: number | null; unreadOnly?: boolean | null },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
      const offset = Math.max(args.offset ?? 0, 0);
      const conds = [eq(notifications.userId, user.id)];
      if (args.unreadOnly) conds.push(isNull(notifications.readAt));
      return db
        .select()
        .from(notifications)
        .where(and(...conds))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);
    },
    unreadNotificationsCount: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ): Promise<number> => {
      const user = requireUser(ctx);
      const rows = await db
        .select({ n: count() })
        .from(notifications)
        .where(
          and(eq(notifications.userId, user.id), isNull(notifications.readAt)),
        );
      return Number(rows[0]?.n ?? 0);
    },
    myNotificationPrefs: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      const rows = await db
        .select()
        .from(notificationPrefs)
        .where(eq(notificationPrefs.userId, user.id));
      return toPrefsPayload(rows[0]);
    },
    recommendations: async (
      _: unknown,
      args: { limit?: number | null },
      ctx: GraphQLContext,
    ): Promise<Recommendation[]> => {
      const user = requireUser(ctx);
      const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
      return buildRecommendations(user.id, limit);
    },
    myGoals: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      const rows = await db
        .select()
        .from(readingGoals)
        .where(eq(readingGoals.userId, user.id))
        .orderBy(desc(readingGoals.year));
      return Promise.all(rows.map((r) => goalWithProgress(user.id, r)));
    },
    goal: async (_: unknown, args: { year: number }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      const rows = await db
        .select()
        .from(readingGoals)
        .where(
          and(eq(readingGoals.userId, user.id), eq(readingGoals.year, args.year)),
        );
      if (!rows[0]) return null;
      return goalWithProgress(user.id, rows[0]);
    },
    /** Return the authenticated user's finished-book counts for each month of a year. */
    readingStats: async (
      _: unknown,
      args: { year: number },
      ctx: GraphQLContext,
    ): Promise<{ month: number; finished: number }[]> => {
      const user = requireUser(ctx);
      if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2100) {
        throw badInput("Year must be between 2000 and 2100");
      }
      const rows = await db.all<{ month: number; n: number }>(
        sql`SELECT CAST(strftime('%m', finished_at / 1000, 'unixepoch') AS INTEGER) AS month,
               count(*) AS n
            FROM shelf_items
            WHERE user_id = ${user.id}
              AND status = 'finished'
              AND finished_at IS NOT NULL
              AND CAST(strftime('%Y', finished_at / 1000, 'unixepoch') AS INTEGER) = ${args.year}
            GROUP BY month`,
      );
      const byMonth = new Map(rows.map((r) => [Number(r.month), Number(r.n)]));
      return Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        finished: byMonth.get(i + 1) ?? 0,
      }));
    },
    /** List challenges by status, newest end date first, with bounded pagination. */
    challenges: async (
      _: unknown,
      args: { status?: ChallengeStatus | null; limit?: number | null; offset?: number | null },
    ) => {
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
      const offset = Math.max(args.offset ?? 0, 0);
      const now = Date.now();
      const cond =
        args.status === "UPCOMING"
          ? gt(challenges.startAt, now)
          : args.status === "ENDED"
            ? lt(challenges.endAt, now)
            : args.status === "ACTIVE"
              ? and(lte(challenges.startAt, now), gte(challenges.endAt, now))
              : undefined;
      return db
        .select()
        .from(challenges)
        .where(cond)
        .orderBy(desc(challenges.endAt), desc(challenges.id))
        .limit(limit)
        .offset(offset);
    },
    /** Find a challenge by ID, returning null when it does not exist. */
    challenge: async (_: unknown, args: { id: string }) => {
      const rows = await db.select().from(challenges).where(eq(challenges.id, args.id));
      return rows[0] ?? null;
    },
    exportData: async (_: unknown, __: unknown, ctx: GraphQLContext): Promise<string> => {
      const user = requireUser(ctx);
      const [shelf, revs, favs, goals] = await Promise.all([
        db
          .select({ item: shelfItems, book: books })
          .from(shelfItems)
          .innerJoin(books, eq(shelfItems.bookId, books.id))
          .where(eq(shelfItems.userId, user.id)),
        db
          .select({ review: reviews, book: books })
          .from(reviews)
          .innerJoin(books, eq(reviews.bookId, books.id))
          .where(eq(reviews.userId, user.id)),
        db
          .select({ book: books })
          .from(favorites)
          .innerJoin(books, eq(favorites.bookId, books.id))
          .where(eq(favorites.userId, user.id)),
        db.select().from(readingGoals).where(eq(readingGoals.userId, user.id)),
      ]);
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        user: { email: user.email, name: user.name },
        shelf: shelf.map((r) => ({
          status: r.item.status,
          progress: r.item.progress,
          book: { title: r.book.title, author: r.book.author, year: r.book.year },
        })),
        reviews: revs.map((r) => ({
          rating: r.review.rating,
          text: r.review.text,
          book: { title: r.book.title, author: r.book.author },
        })),
        favorites: favs.map((r) => ({ title: r.book.title, author: r.book.author })),
        goals: goals.map((g) => ({ year: g.year, target: g.target })),
      });
    },
    exportCsv: async (_: unknown, __: unknown, ctx: GraphQLContext): Promise<string> => {
      const user = requireUser(ctx);
      const [shelf, revs] = await Promise.all([
        db
          .select({ item: shelfItems, book: books })
          .from(shelfItems)
          .innerJoin(books, eq(shelfItems.bookId, books.id))
          .where(eq(shelfItems.userId, user.id))
          .orderBy(books.title),
        db
          .select()
          .from(reviews)
          .where(eq(reviews.userId, user.id)),
      ]);
      const ratingByBook = new Map(revs.map((r) => [r.bookId, r.rating]));
      const SHELF_TO_GOODREADS: Record<ShelfStatus, string> = {
        finished: "read",
        reading: "currently-reading",
        want_to_read: "to-read",
      };
      const cell = (v: string | number | null | undefined): string => {
        const s = v == null ? "" : String(v);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ["Title", "Author", "My Rating", "Exclusive Shelf", "Original Publication Year"];
      const lines = [header.join(",")];
      for (const r of shelf) {
        lines.push(
          [
            cell(r.book.title),
            cell(r.book.author),
            cell(ratingByBook.get(r.book.id) ?? 0),
            SHELF_TO_GOODREADS[r.item.status as ShelfStatus],
            cell(r.book.year),
          ].join(","),
        );
      }
      return lines.join("\n") + "\n";
    },
  },

  Mutation: {
    register: async (
      _: unknown,
      args: { email: string; password: string; name: string },
    ) => {
      const email = args.email.trim().toLowerCase();
      const name = args.name.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badInput("Invalid email");
      if (args.password.length < 6) throw badInput("Password too short (min 6)");
      if (!name) throw badInput("Name is required");
      const existing = await db.select().from(users).where(eq(users.email, email));
      if (existing[0]) throw badInput("Email already registered");
      const passwordHash = await hashPassword(args.password);
      const [user] = await db.insert(users).values({ email, name, passwordHash }).returning();
      const pair = await issueAuthPair(user);
      return { ...pair, user: toPublicUser(user) };
    },
    login: async (_: unknown, args: { email: string; password: string }) => {
      const email = args.email.trim().toLowerCase();
      const rows = await db.select().from(users).where(eq(users.email, email));
      const user = rows[0];
      if (!user || !(await verifyPassword(args.password, user.passwordHash))) {
        throw new GraphQLError("Invalid credentials", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      const pair = await issueAuthPair(user);
      return { ...pair, user: toPublicUser(user) };
    },
    refreshToken: async (_: unknown, args: { token: string }) => {
      const rotated = await rotateRefreshToken(args.token);
      if (!rotated) {
        throw new GraphQLError("Invalid or expired refresh token", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return { ...rotated.pair, user: toPublicUser(rotated.user) };
    },
    logout: async (_: unknown, args: { token: string }): Promise<boolean> => {
      await revokeRefreshToken(args.token);
      return true;
    },
    logoutAll: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const user = requireUser(ctx);
      await revokeAllSessions(user.id);
      return true;
    },
    requestPasswordReset: async (
      _: unknown,
      args: { email: string },
    ): Promise<boolean> => {
      const token = await requestPasswordReset(args.email);
      if (token) {
        const base = process.env.CLIENT_URL ?? "http://localhost:5173";
        fireAndForget(
          sendEmail({
            to: args.email.trim().toLowerCase(),
            subject: "Reset your Bookshelf password",
            body: `Reset your password here (valid 1 hour): ${base}/reset-password#token=${token}`,
          }),
        );
      }
      // Always true: never reveal whether the email exists.
      return true;
    },
    resetPassword: async (
      _: unknown,
      args: { token: string; newPassword: string },
    ) => {
      if (args.newPassword.length < 6) {
        throw badInput("New password too short (min 6)");
      }
      const result = await resetPasswordWithToken(args.token, args.newPassword);
      if (!result) {
        throw new GraphQLError("Invalid or expired reset token", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return { ...result.pair, user: toPublicUser(result.user) };
    },
    updateProfile: async (_: unknown, args: { name: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      const name = args.name.trim();
      if (!name) throw badInput("Name is required");
      if (name.length > 100) throw badInput("Name too long (max 100)");
      const [updated] = await db
        .update(users)
        .set({ name })
        .where(eq(users.id, user.id))
        .returning();
      return toPublicUser(updated);
    },
    changePassword: async (
      _: unknown,
      args: { currentPassword: string; newPassword: string },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const rows = await db.select().from(users).where(eq(users.id, user.id));
      const current = rows[0];
      if (!current || !(await verifyPassword(args.currentPassword, current.passwordHash))) {
        throw new GraphQLError("Current password is incorrect", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      if (args.newPassword.length < 6) {
        throw badInput("New password too short (min 6)");
      }
      const passwordHash = await hashPassword(args.newPassword);
      await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
      // Rotate everything: all sessions die, caller gets a fresh pair.
      await revokeAllSessions(user.id);
      const fresh = await db.select().from(users).where(eq(users.id, user.id));
      const pair = await issueAuthPair(fresh[0]!);
      return { ...pair, user: toPublicUser(fresh[0]!) };
    },
    setNotificationPrefs: async (
      _: unknown,
      args: { follow?: boolean | null; like?: boolean | null; comment?: boolean | null },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const patch: { follow?: number; like?: number; comment?: number } = {};
      if (args.follow !== undefined && args.follow !== null) {
        patch.follow = args.follow ? 1 : 0;
      }
      if (args.like !== undefined && args.like !== null) {
        patch.like = args.like ? 1 : 0;
      }
      if (args.comment !== undefined && args.comment !== null) {
        patch.comment = args.comment ? 1 : 0;
      }
      const existing = await db
        .select()
        .from(notificationPrefs)
        .where(eq(notificationPrefs.userId, user.id));
      const row = existing[0]
        ? (
            await db
              .update(notificationPrefs)
              .set(patch)
              .where(eq(notificationPrefs.userId, user.id))
              .returning()
          )[0]!
        : (
            await db
              .insert(notificationPrefs)
              .values({ userId: user.id, ...patch })
              .returning()
          )[0]!;
      return toPrefsPayload(row);
    },
    addBook: async (
      _: unknown,
      args: {
        title: string;
        author: string;
        year?: number | null;
        description?: string | null;
        coverUrl?: string | null;
      },
      ctx: GraphQLContext,
    ): Promise<Book> => {
      const user = requireUser(ctx);
      if (!args.title.trim()) throw badInput("Title is required");
      if (!args.author.trim()) throw badInput("Author is required");
      const [book] = await db
        .insert(books)
        .values({
          title: args.title.trim(),
          author: args.author.trim(),
          year: args.year ?? null,
          description: args.description?.trim() || null,
          coverUrl: args.coverUrl?.trim() || null,
          createdBy: user.id,
        })
        .returning();
      return book;
    },
    updateBook: async (
      _: unknown,
      args: {
        id: string;
        title?: string | null;
        author?: string | null;
        year?: number | null;
        description?: string | null;
        coverUrl?: string | null;
      },
      ctx: GraphQLContext,
    ): Promise<Book> => {
      const user = requireUser(ctx);
      const book = await getBookOrThrow(args.id);
      assertCanEdit(book, user, "edit this book");
      const patch: Partial<Book> = {};
      if (args.title !== undefined && args.title !== null) {
        if (!args.title.trim()) throw badInput("Title cannot be empty");
        patch.title = args.title.trim();
      }
      if (args.author !== undefined && args.author !== null) {
        if (!args.author.trim()) throw badInput("Author cannot be empty");
        patch.author = args.author.trim();
      }
      if (args.year !== undefined) patch.year = args.year;
      if (args.description !== undefined)
        patch.description = args.description?.trim() || null;
      if (args.coverUrl !== undefined) patch.coverUrl = args.coverUrl?.trim() || null;
      if (Object.keys(patch).length === 0) return book;
      const [updated] = await db
        .update(books)
        .set(patch)
        .where(eq(books.id, args.id))
        .returning();
      return updated;
    },
    deleteBook: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const user = requireUser(ctx);
      const book = await getBookOrThrow(args.id);
      assertCanEdit(book, user, "delete this book");
      await db.delete(books).where(eq(books.id, args.id));
      await deleteCoverForBook(args.id);
      await audit(user.id, "BOOK_DELETE", "book", args.id, book.title);
      return true;
    },
    setShelfStatus: async (
      _: unknown,
      args: { bookId: string; status: ShelfStatus },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      if (!SHELF_STATUSES.includes(args.status)) throw badInput("Invalid status");
      await getBookOrThrow(args.bookId);
      const existing = await db
        .select()
        .from(shelfItems)
        .where(
          and(eq(shelfItems.userId, user.id), eq(shelfItems.bookId, args.bookId)),
        );
      if (existing[0]) {
        const finishedAt =
          args.status === "finished"
            ? (existing[0].finishedAt ?? Date.now())
            : null;
        const [updated] = await db
          .update(shelfItems)
          .set({ status: args.status, finishedAt, updatedAt: Date.now() })
          .where(eq(shelfItems.id, existing[0].id))
          .returning();
        return updated;
      }
      const [created] = await db
        .insert(shelfItems)
        .values({
          userId: user.id,
          bookId: args.bookId,
          status: args.status,
          finishedAt: args.status === "finished" ? Date.now() : null,
        })
        .returning();
      return created;
    },
    removeFromShelf: async (
      _: unknown,
      args: { bookId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const user = requireUser(ctx);
      await db
        .delete(shelfItems)
        .where(
          and(eq(shelfItems.userId, user.id), eq(shelfItems.bookId, args.bookId)),
        );
      return true;
    },
    updateShelfProgress: async (
      _: unknown,
      args: { bookId: string; progress: number },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      if (!Number.isInteger(args.progress) || args.progress < 0 || args.progress > 100) {
        throw badInput("Progress must be an integer from 0 to 100");
      }
      await getBookOrThrow(args.bookId);
      const existing = await db
        .select()
        .from(shelfItems)
        .where(
          and(eq(shelfItems.userId, user.id), eq(shelfItems.bookId, args.bookId)),
        );
      const status =
        args.progress >= 100
          ? "finished"
          : existing[0]?.status ?? "reading";
      const finishedAt =
        status === "finished"
          ? (existing[0]?.finishedAt ?? Date.now())
          : null;
      if (existing[0]) {
        const [updated] = await db
          .update(shelfItems)
          .set({ progress: args.progress, status, finishedAt, updatedAt: Date.now() })
          .where(eq(shelfItems.id, existing[0].id))
          .returning();
        return updated;
      }
      const [created] = await db
        .insert(shelfItems)
        .values({ userId: user.id, bookId: args.bookId, status, progress: args.progress, finishedAt })
        .returning();
      return created;
    },
    toggleFavorite: async (
      _: unknown,
      args: { bookId: string },
      ctx: GraphQLContext,
    ): Promise<Book> => {
      const user = requireUser(ctx);
      const book = await getBookOrThrow(args.bookId);
      const existing = await db
        .select()
        .from(favorites)
        .where(and(eq(favorites.userId, user.id), eq(favorites.bookId, args.bookId)));
      if (existing[0]) {
        await db.delete(favorites).where(eq(favorites.id, existing[0].id));
      } else {
        await db.insert(favorites).values({ userId: user.id, bookId: args.bookId });
      }
      return book;
    },
    addTagToBook: async (
      _: unknown,
      args: { bookId: string; name: string },
      ctx: GraphQLContext,
    ): Promise<Book> => {
      const user = requireUser(ctx);
      const book = await getBookOrThrow(args.bookId);
      assertCanEdit(book, user, "tag this book");
      await linkTagToBook(args.bookId, args.name);
      return book;
    },
    removeTagFromBook: async (
      _: unknown,
      args: { bookId: string; name: string },
      ctx: GraphQLContext,
    ): Promise<Book> => {
      const user = requireUser(ctx);
      const book = await getBookOrThrow(args.bookId);
      assertCanEdit(book, user, "untag this book");
      const name = normalizeTagName(args.name);
      const tag = (await db.select().from(tags).where(eq(tags.name, name)))[0];
      if (tag) {
        await db
          .delete(bookTags)
          .where(
            and(eq(bookTags.bookId, args.bookId), eq(bookTags.tagId, tag.id)),
          );
        // Drop the tag itself once nothing references it.
        const refs = await db
          .select({ id: bookTags.id })
          .from(bookTags)
          .where(eq(bookTags.tagId, tag.id))
          .limit(1);
        if (refs.length === 0) {
          await db.delete(tags).where(eq(tags.id, tag.id));
        }
      }
      return book;
    },
    toggleReviewLike: async (
      _: unknown,
      args: { reviewId: string },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const review = await getReviewOrThrow(args.reviewId);
      const existing = await db
        .select()
        .from(reviewLikes)
        .where(
          and(eq(reviewLikes.userId, user.id), eq(reviewLikes.reviewId, args.reviewId)),
        );
      if (existing[0]) {
        await db.delete(reviewLikes).where(eq(reviewLikes.id, existing[0].id));
        await retractUnread({
          userId: review.userId,
          actorId: user.id,
          type: "REVIEW_LIKE",
          reviewId: review.id,
        });
      } else {
        await db
          .insert(reviewLikes)
          .values({ userId: user.id, reviewId: args.reviewId });
        await notify({
          userId: review.userId,
          actorId: user.id,
          type: "REVIEW_LIKE",
          reviewId: review.id,
          bookId: review.bookId,
        });
      }
      return review;
    },
    upsertReview: async (
      _: unknown,
      args: { bookId: string; rating: number; text?: string | null },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
        throw badInput("Rating must be an integer from 1 to 5");
      }
      await getBookOrThrow(args.bookId);
      const text = args.text?.trim() || null;
      const existing = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.userId, user.id), eq(reviews.bookId, args.bookId)));
      if (existing[0]) {
        const [updated] = await db
          .update(reviews)
          .set({ rating: args.rating, text, updatedAt: Date.now() })
          .where(eq(reviews.id, existing[0].id))
          .returning();
        return updated;
      }
      const [created] = await db
        .insert(reviews)
        .values({ userId: user.id, bookId: args.bookId, rating: args.rating, text })
        .returning();
      return created;
    },
    deleteReview: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const user = requireUser(ctx);
      const rows = await db.select().from(reviews).where(eq(reviews.id, args.id));
      const review = rows[0];
      if (!review) return false;
      if (review.userId !== user.id) {
        throw new GraphQLError("Only the author can delete this review", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      await db.delete(reviews).where(eq(reviews.id, args.id));
      return true;
    },
    addComment: async (
      _: unknown,
      args: { reviewId: string; text: string },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const review = await getReviewOrThrow(args.reviewId);
      const text = validateCommentText(args.text);
      const [comment] = await db
        .insert(reviewComments)
        .values({ userId: user.id, reviewId: args.reviewId, text })
        .returning();
      await notify({
        userId: review.userId,
        actorId: user.id,
        type: "REVIEW_COMMENT",
        reviewId: review.id,
        commentId: comment.id,
        bookId: review.bookId,
      });
      return comment;
    },
    updateComment: async (
      _: unknown,
      args: { id: string; text: string },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const rows = await db
        .select()
        .from(reviewComments)
        .where(eq(reviewComments.id, args.id));
      const comment = rows[0];
      if (!comment) {
        throw new GraphQLError("Comment not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      if (comment.userId !== user.id) {
        throw new GraphQLError("Only the author can edit this comment", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const [updated] = await db
        .update(reviewComments)
        .set({ text: validateCommentText(args.text), updatedAt: Date.now() })
        .where(eq(reviewComments.id, args.id))
        .returning();
      return updated;
    },
    deleteComment: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const user = requireUser(ctx);
      const rows = await db
        .select()
        .from(reviewComments)
        .where(eq(reviewComments.id, args.id));
      const comment = rows[0];
      if (!comment) return false;
      if (comment.userId !== user.id) {
        throw new GraphQLError("Only the author can delete this comment", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      await db.delete(reviewComments).where(eq(reviewComments.id, args.id));
      return true;
    },
    followUser: async (
      _: unknown,
      args: { userId: string },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      if (args.userId === user.id) throw badInput("You cannot follow yourself");
      const target = await getUserOrThrow(args.userId);
      await db
        .insert(follows)
        .values({ followerId: user.id, followeeId: args.userId })
        .onConflictDoNothing();
      await notify({ userId: target.id, actorId: user.id, type: "FOLLOW" });
      return toPublicUser(target);
    },
    setUserRole: async (
      _: unknown,
      args: { userId: string; role: Role },
      ctx: GraphQLContext,
    ) => {      const admin = requireAdmin(ctx);
      if (args.role !== "admin" && args.role !== "member") {
        throw badInput("Invalid role");
      }
      if (args.userId === admin.id) {
        throw badInput("You cannot change your own role");
      }
      const target = await getUserOrThrow(args.userId);
      const [updated] = await db
        .update(users)
        .set({ role: args.role })
        .where(eq(users.id, target.id))
        .returning();
      await audit(admin.id, "ROLE_CHANGE", "user", target.id, `role=${args.role}`);
      return toPublicUser(updated);
    },
    deleteUser: async (
      _: unknown,
      args: { userId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const admin = requireAdmin(ctx);
      if (args.userId === admin.id) {
        throw badInput("You cannot delete yourself");
      }
      await getUserOrThrow(args.userId);
      // books.created_by is intentionally FK-less (seed books are ownerless),
      // so remove owned books explicitly; their reviews/shelf/favorites/tags
      // cascade via book FKs. Everything else cascades via user FKs.
      await db.delete(books).where(eq(books.createdBy, args.userId));
      await db.delete(users).where(eq(users.id, args.userId));
      await audit(admin.id, "USER_DELETE", "user", args.userId);
      return true;
    },
    mergeBooks: async (
      _: unknown,
      args: { sourceId: string; targetId: string },
      ctx: GraphQLContext,
    ): Promise<Book> => {
      const admin = requireAdmin(ctx);
      if (args.sourceId === args.targetId) {
        throw badInput("Cannot merge a book into itself");
      }
      const source = await getBookOrThrow(args.sourceId);
      await getBookOrThrow(args.targetId);

      const STATUS_RANK: Record<ShelfStatus, number> = {
        want_to_read: 1,
        reading: 2,
        finished: 3,
      };

      // Reviews: one per user survives — prefer text, then rating, then newest.
      const [sourceReviews, targetReviews] = await Promise.all([
        db.select().from(reviews).where(eq(reviews.bookId, args.sourceId)),
        db.select().from(reviews).where(eq(reviews.bookId, args.targetId)),
      ]);
      const targetByUser = new Map(targetReviews.map((r) => [r.userId, r]));
      for (const sr of sourceReviews) {
        const tr = targetByUser.get(sr.userId);
        if (!tr) {
          await db
            .update(reviews)
            .set({ bookId: args.targetId })
            .where(eq(reviews.id, sr.id));
          continue;
        }
        const score = (r: typeof sr) =>
          (r.text ? 100 : 0) + r.rating * 10 + Math.min(r.createdAt / 1e12, 9);
        if (score(sr) > score(tr)) {
          await db.delete(reviews).where(eq(reviews.id, tr.id));
          await db
            .update(reviews)
            .set({ bookId: args.targetId })
            .where(eq(reviews.id, sr.id));
        } else {
          await db.delete(reviews).where(eq(reviews.id, sr.id));
        }
      }

      // Shelf: keep the most advanced status and max progress per user.
      const [sourceShelf, targetShelf] = await Promise.all([
        db.select().from(shelfItems).where(eq(shelfItems.bookId, args.sourceId)),
        db.select().from(shelfItems).where(eq(shelfItems.bookId, args.targetId)),
      ]);
      const targetShelfByUser = new Map(targetShelf.map((s) => [s.userId, s]));
      for (const ss of sourceShelf) {
        const ts = targetShelfByUser.get(ss.userId);
        if (!ts) {
          await db
            .update(shelfItems)
            .set({ bookId: args.targetId })
            .where(eq(shelfItems.id, ss.id));
          continue;
        }
        const status =
          STATUS_RANK[ts.status as ShelfStatus] >= STATUS_RANK[ss.status as ShelfStatus]
            ? ts.status
            : ss.status;
        const finishedAt =
          status === "finished"
            ? [ts.finishedAt, ss.finishedAt]
                .filter((v): v is number => v != null)
                .reduce((a, b) => Math.min(a, b), Date.now())
            : null;
        await db
          .update(shelfItems)
          .set({
            status,
            progress: Math.max(ts.progress, ss.progress),
            finishedAt,
            updatedAt: Date.now(),
          })
          .where(eq(shelfItems.id, ts.id));
        await db.delete(shelfItems).where(eq(shelfItems.id, ss.id));
      }

      // Favorites and tags: repoint, dropping duplicates.
      const targetFavUserIds = new Set(
        (
          await db
            .select({ userId: favorites.userId })
            .from(favorites)
            .where(eq(favorites.bookId, args.targetId))
        ).map((r) => r.userId),
      );
      await db.delete(favorites).where(
        and(
          eq(favorites.bookId, args.sourceId),
          ...(targetFavUserIds.size > 0
            ? [inArray(favorites.userId, [...targetFavUserIds])]
            : [sql`1 = 0`]),
        ),
      );
      await db
        .update(favorites)
        .set({ bookId: args.targetId })
        .where(eq(favorites.bookId, args.sourceId));

      const targetTagIds = new Set(
        (
          await db
            .select({ tagId: bookTags.tagId })
            .from(bookTags)
            .where(eq(bookTags.bookId, args.targetId))
        ).map((r) => r.tagId),
      );
      if (targetTagIds.size > 0) {
        await db.delete(bookTags).where(
          and(
            eq(bookTags.bookId, args.sourceId),
            inArray(bookTags.tagId, [...targetTagIds]),
          ),
        );
      }
      await db
        .update(bookTags)
        .set({ bookId: args.targetId })
        .where(eq(bookTags.bookId, args.sourceId));

      // Notifications follow the surviving rows (deleted losers cascade).
      await db
        .update(notifications)
        .set({ bookId: args.targetId })
        .where(eq(notifications.bookId, args.sourceId));

      await db.delete(books).where(eq(books.id, args.sourceId));
      await deleteCoverForBook(args.sourceId);
      await audit(
        admin.id,
        "BOOK_MERGE",
        "book",
        args.targetId,
        `${source.title} by ${source.author} merged into it`,
      );
      const [target] = await db.select().from(books).where(eq(books.id, args.targetId));
      return target!;
    },
    markNotificationRead: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const rows = await db
        .select()
        .from(notifications)
        .where(
          and(eq(notifications.id, args.id), eq(notifications.userId, user.id)),
        );
      const row = rows[0];
      if (!row) {
        throw new GraphQLError("Notification not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      if (row.readAt == null) {
        const [updated] = await db
          .update(notifications)
          .set({ readAt: Date.now() })
          .where(eq(notifications.id, row.id))
          .returning();
        return updated;
      }
      return row;
    },
    markAllNotificationsRead: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ): Promise<number> => {
      const user = requireUser(ctx);
      const unread = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(eq(notifications.userId, user.id), isNull(notifications.readAt)),
        );
      if (unread.length > 0) {
        await db
          .update(notifications)
          .set({ readAt: Date.now() })
          .where(
            and(eq(notifications.userId, user.id), isNull(notifications.readAt)),
          );
      }
      return unread.length;
    },
    setGoal: async (
      _: unknown,
      args: { year: number; target: number },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2100) {
        throw badInput("Year must be between 2000 and 2100");
      }
      if (!Number.isInteger(args.target) || args.target < 1 || args.target > 1000) {
        throw badInput("Target must be between 1 and 1000");
      }
      const existing = await db
        .select()
        .from(readingGoals)
        .where(
          and(eq(readingGoals.userId, user.id), eq(readingGoals.year, args.year)),
        );
      const row = existing[0]
        ? (
            await db
              .update(readingGoals)
              .set({ target: args.target })
              .where(eq(readingGoals.id, existing[0].id))
              .returning()
          )[0]!
        : (
            await db
              .insert(readingGoals)
              .values({ userId: user.id, year: args.year, target: args.target })
              .returning()
          )[0]!;
      return goalWithProgress(user.id, row);
    },
    deleteGoal: async (
      _: unknown,
      args: { year: number },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const user = requireUser(ctx);
      await db
        .delete(readingGoals)
        .where(
          and(eq(readingGoals.userId, user.id), eq(readingGoals.year, args.year)),
        );
      return true;
    },
    /** Validate and create a challenge, enrolling its creator as the first member. */
    createChallenge: async (
      _: unknown,
      args: {
        name: string;
        description?: string | null;
        startAt: number;
        endAt: number;
        target: number;
      },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const name = args.name.trim();
      if (!name) throw badInput("Name is required");
      if (name.length > 120) throw badInput("Name too long (max 120)");
      if (!Number.isFinite(args.startAt) || !Number.isFinite(args.endAt)) {
        throw badInput("Invalid dates");
      }
      if (args.startAt >= args.endAt) throw badInput("End must be after start");
      if (!Number.isInteger(args.target) || args.target < 1 || args.target > 1000) {
        throw badInput("Target must be between 1 and 1000");
      }
      const [row] = await db
        .insert(challenges)
        .values({
          name,
          description: args.description?.trim() || null,
          startAt: Math.floor(args.startAt),
          endAt: Math.floor(args.endAt),
          target: args.target,
          createdBy: user.id,
        })
        .returning();
      await db
        .insert(challengeMembers)
        .values({ challengeId: row.id, userId: user.id })
        .onConflictDoNothing();
      return row;
    },
    /** Enroll the authenticated user in an existing challenge. */
    joinChallenge: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      const row = await getChallengeOrThrow(args.id);
      await db
        .insert(challengeMembers)
        .values({ challengeId: row.id, userId: user.id })
        .onConflictDoNothing();
      return row;
    },
    /** Remove the authenticated user's membership from a challenge. */
    leaveChallenge: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const user = requireUser(ctx);
      await db
        .delete(challengeMembers)
        .where(
          and(
            eq(challengeMembers.challengeId, args.id),
            eq(challengeMembers.userId, user.id),
          ),
        );
      return true;
    },
    /** Delete a challenge when requested by its creator or an admin. */
    deleteChallenge: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const user = requireUser(ctx);
      const row = await getChallengeOrThrow(args.id);
      if (row.createdBy !== user.id && user.role !== "admin") {
        throw new GraphQLError("Only the creator or an admin can delete this challenge", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      await db.delete(challenges).where(eq(challenges.id, args.id));
      return true;
    },
    importBooks: async (
      _: unknown,
      args: {
        books: {
          title: string;
          author: string;
          year?: number | null;
          description?: string | null;
          shelf?: ShelfStatus | null;
          rating?: number | null;
          reviewText?: string | null;
        }[];
      },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      if (args.books.length > 200) {
        throw badInput("At most 200 books per import");
      }
      let imported = 0;
      let matched = 0;
      let shelved = 0;
      let reviewed = 0;
      const errors: string[] = [];

      for (let i = 0; i < args.books.length; i++) {
        const entry = args.books[i]!;
        try {
          const title = entry.title?.trim();
          const author = entry.author?.trim();
          if (!title || !author) throw new Error("title and author are required");
          if (entry.rating != null && (!Number.isInteger(entry.rating) || entry.rating < 1 || entry.rating > 5)) {
            throw new Error("rating must be 1–5");
          }
          if (entry.shelf != null && !SHELF_STATUSES.includes(entry.shelf)) {
            throw new Error("invalid shelf status");
          }

          const found = await db.all<{ id: string }>(
            sql`SELECT id FROM books WHERE lower(title) = lower(${title}) AND lower(author) = lower(${author}) LIMIT 1`,
          );
          let bookId: string;
          if (found[0]) {
            bookId = found[0].id;
            matched += 1;
          } else {
            const [created] = await db
              .insert(books)
              .values({
                title,
                author,
                year: entry.year ?? null,
                description: entry.description?.trim() || null,
                createdBy: user.id,
              })
              .returning();
            bookId = created.id;
            imported += 1;
          }

          if (entry.shelf) {
            const existingShelf = await db
              .select()
              .from(shelfItems)
              .where(and(eq(shelfItems.userId, user.id), eq(shelfItems.bookId, bookId)));
            const finishedAt =
              entry.shelf === "finished"
                ? (existingShelf[0]?.finishedAt ?? Date.now())
                : null;
            if (existingShelf[0]) {
              await db
                .update(shelfItems)
                .set({ status: entry.shelf, finishedAt, updatedAt: Date.now() })
                .where(eq(shelfItems.id, existingShelf[0].id));
            } else {
              await db
                .insert(shelfItems)
                .values({ userId: user.id, bookId, status: entry.shelf, finishedAt });
            }
            shelved += 1;
          }

          if (entry.rating != null) {
            const existingReview = await db
              .select({ id: reviews.id })
              .from(reviews)
              .where(and(eq(reviews.userId, user.id), eq(reviews.bookId, bookId)));
            const text = entry.reviewText?.trim() || null;
            if (existingReview[0]) {
              await db
                .update(reviews)
                .set({ rating: entry.rating, text, updatedAt: Date.now() })
                .where(eq(reviews.id, existingReview[0].id));
            } else {
              await db
                .insert(reviews)
                .values({ userId: user.id, bookId, rating: entry.rating, text });
            }
            reviewed += 1;
          }
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
      return { imported, matched, shelved, reviewed, errors };
    },
    unfollowUser: async (
      _: unknown,
      args: { userId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const user = requireUser(ctx);
      await db
        .delete(follows)
        .where(
          and(eq(follows.followerId, user.id), eq(follows.followeeId, args.userId)),
        );
      await retractUnread({ userId: args.userId, actorId: user.id, type: "FOLLOW" });
      return true;
    },
  },

  Book: {
    averageRating: async (parent: Book, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.bookStats.load(parent.id)).averageRating,
    reviewsCount: async (parent: Book, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.bookStats.load(parent.id)).reviewsCount,
    tags: (parent: Book, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.bookTags.load(parent.id),
    isFavorite: (parent: Book, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.favoriteMap.load(parent.id),
    shelfStatus: (parent: Book, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.shelfMap.load(parent.id),
    reviews: (parent: Book, args: ListReviewsArgs) =>
      listReviews(parent.id, args),
  },

  ShelfItem: {
    book: async (parent: { bookId: string }, _: unknown, ctx: GraphQLContext) => {
      const book = await ctx.loaders.bookById.load(parent.bookId);
      if (!book) throw new GraphQLError("Book not found", { extensions: { code: "NOT_FOUND" } });
      return book;
    },
  },

  User: {
    followersCount: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.followStats.load(parent.id)).followersCount,
    followingCount: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.followStats.load(parent.id)).followingCount,
    isFollowing: (parent: { id: string }, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.isFollowingMap.load(parent.id),
  },

  ActivityItem: {
    user: async (parent: FeedItem, _: unknown, ctx: GraphQLContext) => {
      const u = await ctx.loaders.userById.load(parent.userId);
      if (!u) throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      return toPublicUser(u);
    },
    book: async (parent: FeedItem, _: unknown, ctx: GraphQLContext) => {
      const book = await ctx.loaders.bookById.load(parent.bookId);
      if (!book) throw new GraphQLError("Book not found", { extensions: { code: "NOT_FOUND" } });
      return book;
    },
    review: (parent: FeedItem, _: unknown, ctx: GraphQLContext) =>
      parent.reviewId ? ctx.loaders.reviewById.load(parent.reviewId) : null,
  },

  ReviewComment: {
    user: async (parent: { userId: string }, _: unknown, ctx: GraphQLContext) => {
      const u = await ctx.loaders.userById.load(parent.userId);
      if (!u) throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      return toPublicUser(u);
    },
    review: async (parent: { reviewId: string }, _: unknown, ctx: GraphQLContext) => {
      const review = await ctx.loaders.reviewById.load(parent.reviewId);
      if (!review) {
        throw new GraphQLError("Review not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return review;
    },
  },

  Notification: {
    actor: async (parent: DbNotification, _: unknown, ctx: GraphQLContext) => {
      const actor = await ctx.loaders.userById.load(parent.actorId);
      if (!actor) throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      return toPublicUser(actor);
    },
    book: (parent: DbNotification, _: unknown, ctx: GraphQLContext) =>
      parent.bookId ? ctx.loaders.bookById.load(parent.bookId) : null,
    review: (parent: DbNotification, _: unknown, ctx: GraphQLContext) =>
      parent.reviewId ? ctx.loaders.reviewById.load(parent.reviewId) : null,
    comment: (parent: DbNotification, _: unknown, ctx: GraphQLContext) =>
      parent.commentId ? ctx.loaders.commentById.load(parent.commentId) : null,
  },

  Tag: {
    booksCount: (parent: Tag, _: unknown, ctx: GraphQLContext): Promise<number> =>
      ctx.loaders.tagBooksCount.load(parent.id),
  },

  Challenge: {
    /** Resolve the challenge's current time-based status. */
    status: (parent: { startAt: number; endAt: number }) => challengeStatusOf(parent),
    /** Count the challenge's enrolled users. */
    memberCount: async (parent: { id: string }): Promise<number> => {
      const rows = await db
        .select({ n: count() })
        .from(challengeMembers)
        .where(eq(challengeMembers.challengeId, parent.id));
      return Number(rows[0]?.n ?? 0);
    },
    /** Check whether the current user belongs to the challenge. */
    isMember: async (
      parent: { id: string },
      _: unknown,
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      if (!ctx.user) return false;
      const rows = await db
        .select({ id: challengeMembers.id })
        .from(challengeMembers)
        .where(
          and(
            eq(challengeMembers.challengeId, parent.id),
            eq(challengeMembers.userId, ctx.user.id),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
    /** Count the current user's completed books during the challenge. */
    myProgress: async (
      parent: { id: string; startAt: number; endAt: number },
      _: unknown,
      ctx: GraphQLContext,
    ): Promise<number> => {
      if (!ctx.user) return 0;
      return finishedInWindow(ctx.user.id, parent.startAt, parent.endAt);
    },
    /** Rank members by completed books and cap the returned entries. */
    leaderboard: async (
      parent: { id: string; startAt: number; endAt: number; target: number },
      args: { limit?: number | null },
      ctx: GraphQLContext,
    ) => {
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
      const rows = await db.all<{ userId: string; n: number; joinedAt: number }>(
        sql`SELECT cm.user_id AS userId, count(si.id) AS n, min(cm.joined_at) AS joinedAt
            FROM challenge_members cm
            LEFT JOIN shelf_items si
              ON si.user_id = cm.user_id AND si.status = 'finished'
              AND si.finished_at >= ${parent.startAt} AND si.finished_at <= ${parent.endAt}
            WHERE cm.challenge_id = ${parent.id}
            GROUP BY cm.user_id
            ORDER BY n DESC, joinedAt ASC, userId ASC
            LIMIT ${limit}`,
      );
      const entries = await Promise.all(
        rows.map(async (r) => {
          const user = await ctx.loaders.userById.load(r.userId);
          if (!user) return null;
          const finished = Number(r.n);
          return {
            user: { id: user.id, name: user.name },
            finished,
            percent: Math.min(100, Math.round((finished / parent.target) * 100)),
          };
        }),
      );
      return entries.filter((e) => e !== null);
    },
  },

  AuditEntry: {
    actor: async (
      parent: { actorId: string | null },
      _: unknown,
      ctx: GraphQLContext,
    ) => {
      if (!parent.actorId) return null;
      const actor = await ctx.loaders.userById.load(parent.actorId);
      return actor ? toPublicUser(actor) : null;
    },
  },

  Review: {
    user: async (parent: { userId: string }, _: unknown, ctx: GraphQLContext) => {
      const u = await ctx.loaders.userById.load(parent.userId);
      if (!u) throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      return toPublicUser(u);
    },
    book: async (parent: { bookId: string }, _: unknown, ctx: GraphQLContext) => {
      const book = await ctx.loaders.bookById.load(parent.bookId);
      if (!book) throw new GraphQLError("Book not found", { extensions: { code: "NOT_FOUND" } });
      return book;
    },
    likesCount: async (
      parent: { id: string },
      _: unknown,
      ctx: GraphQLContext,
    ): Promise<number> =>
      (await ctx.loaders.reviewLikeStats.load(parent.id)).likesCount,
    likedByMe: async (
      parent: { id: string },
      _: unknown,
      ctx: GraphQLContext,
    ): Promise<boolean> =>
      (await ctx.loaders.reviewLikeStats.load(parent.id)).likedByMe,
    commentsCount: (
      parent: { id: string },
      _: unknown,
      ctx: GraphQLContext,
    ): Promise<number> => ctx.loaders.reviewCommentCounts.load(parent.id),
    comments: async (
      parent: { id: string },
      args: { limit?: number | null; offset?: number | null },
    ) => {
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
      const offset = Math.max(args.offset ?? 0, 0);
      return db
        .select()
        .from(reviewComments)
        .where(eq(reviewComments.reviewId, parent.id))
        .orderBy(reviewComments.createdAt)
        .limit(limit)
        .offset(offset);
    },
  },
};
