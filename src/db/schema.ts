import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role")
    .notNull()
    .$defaultFn((): Role => "member"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type Role = "admin" | "member";

export const books = sqliteTable("books", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  author: text("author").notNull(),
  year: integer("year"),
  description: text("description"),
  coverUrl: text("cover_url"),
  createdBy: text("created_by"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type ShelfStatus = "want_to_read" | "reading" | "finished";

export const shelfItems = sqliteTable("shelf_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  status: text("status").notNull().$defaultFn((): ShelfStatus => "want_to_read"),
  progress: integer("progress")
    .notNull()
    .$defaultFn(() => 0),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const reviews = sqliteTable("reviews", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  text: text("text"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const favorites = sqliteTable("favorites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type User = typeof users.$inferSelect;
export type Book = typeof books.$inferSelect;
export type ShelfItem = typeof shelfItems.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;

export const tags = sqliteTable("tags", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const bookTags = sqliteTable("book_tags", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

export type Tag = typeof tags.$inferSelect;
export type BookTag = typeof bookTags.$inferSelect;

export const reviewLikes = sqliteTable("review_likes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reviewId: text("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type ReviewLike = typeof reviewLikes.$inferSelect;

export const reviewComments = sqliteTable("review_comments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reviewId: text("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type ReviewComment = typeof reviewComments.$inferSelect;

export const follows = sqliteTable("follows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  followerId: text("follower_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  followeeId: text("followee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type Follow = typeof follows.$inferSelect;

export const notifications = sqliteTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorId: text("actor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  reviewId: text("review_id").references(() => reviews.id, {
    onDelete: "cascade",
  }),
  commentId: text("comment_id").references(() => reviewComments.id, {
    onDelete: "cascade",
  }),
  bookId: text("book_id").references(() => books.id, { onDelete: "cascade" }),
  readAt: integer("read_at"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationType = "FOLLOW" | "REVIEW_LIKE" | "REVIEW_COMMENT";

export const readingGoals = sqliteTable("reading_goals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  target: integer("target").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type ReadingGoal = typeof readingGoals.$inferSelect;

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(),
});

export type RateLimit = typeof rateLimits.$inferSelect;

export const auditLog = sqliteTable("audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  detail: text("detail"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type AuditEntry = typeof auditLog.$inferSelect;
export type AuditAction = "USER_DELETE" | "ROLE_CHANGE" | "BOOK_DELETE" | "BOOK_MERGE";

export const notificationPrefs = sqliteTable("notification_prefs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  follow: integer("follow").notNull().default(1),
  like: integer("like").notNull().default(1),
  comment: integer("comment").notNull().default(1),
});

export type NotificationPrefs = typeof notificationPrefs.$inferSelect;

export const challenges = sqliteTable("challenges", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  startAt: integer("start_at").notNull(),
  endAt: integer("end_at").notNull(),
  target: integer("target").notNull(),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const challengeMembers = sqliteTable("challenge_members", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  joinedAt: integer("joined_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type Challenge = typeof challenges.$inferSelect;
export type ChallengeMember = typeof challengeMembers.$inferSelect;

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;

export const oauthAccounts = sqliteTable("oauth_accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  email: text("email"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type OAuthAccount = typeof oauthAccounts.$inferSelect;
