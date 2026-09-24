import { useState } from "react";
import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  CheckCircle2,
  CircleUserRound,
  Download,
  FileUp,
  Heart,
  ImagePlus,
  Layers,
  LibraryBig,
  MessageSquare,
  MessagesSquare,
  Minus,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Target,
  Trash2,
  Trophy,
  Upload,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useAuth } from "./auth";
import { useLang, useT, type Dict } from "./i18n";
import { coverSrc, apiBase } from "./covers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ADD_BOOK,
  ADD_COMMENT,
  ADD_TAG,
  CHANGE_PASSWORD,
  DELETE_BOOK,
  DELETE_COMMENT,
  DELETE_REVIEW,
  EXPORT_DATA,
  EXPORT_CSV,
  FOLLOW_USER,
  GET_BOOK,
  GET_BOOKS,
  GET_FEED,
  GET_FAVORITES,
  GET_GOALS,
  GET_NOTIFICATIONS,
  GET_PREFS,
  GET_RECOMMENDATIONS,
  GET_SHELF,
  GET_STATS,
  GET_TAGS,
  GET_UNREAD_COUNT,
  IMPORT_BOOKS,
  MARK_ALL_READ,
  MARK_READ,
  REMOVE_FROM_SHELF,
  REMOVE_TAG,
  SET_GOAL,
  SET_PREFS,
  SET_SHELF_STATUS,
  TOGGLE_FAVORITE,
  TOGGLE_REVIEW_LIKE,
  UNFOLLOW_USER,
  UPDATE_COMMENT,
  UPDATE_PROFILE,
  UPDATE_PROGRESS,
  UPSERT_REVIEW,
} from "./queries";
import type {
  ActivityType,
  BookSort,
  GetBookQuery,
  GetBookQueryVariables,
  GetBooksQuery,
  GetBooksQueryVariables,
  GetFavoritesQuery,
  GetFeedQuery,
  GetGoalsQuery,
  GetNotificationsQuery,
  GetPrefsQuery,
  GetRecommendationsQuery,
  GetShelfQuery,
  GetStatsQuery,
  GetTagsQuery,
  GetUnreadCountQuery,
  NotificationType,
  ReviewSort,
  ShelfStatus,
} from "./types/__generated__/graphql";

const selectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Stars({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold text-sm whitespace-nowrap" title={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          fill={n <= filled ? "currentColor" : "none"}
          className={n <= filled ? "text-amber-500" : "text-muted-foreground"}
        />
      ))}
      <span className="ml-1">{value.toFixed(1)}</span>
    </span>
  );
}

function AuthPanel() {
  const { user, login, register, logout, logoutAll } = useAuth();
  const t = useT();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center gap-2 flex-wrap text-sm p-4">
          <CircleUserRound size={14} className="text-muted-foreground" />
          <span>
            {t.auth.signedInAs} <strong>{user.name}</strong> ({user.email})
          </span>
          <Button size="sm" variant="outline" onClick={() => void logout()}>{t.auth.logout}</Button>
          <Button size="sm" variant="ghost" onClick={() => void logoutAll()}>{t.auth.logoutAll}</Button>
        </CardContent>
      </Card>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.failed);
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="p-4">
        <form onSubmit={submit} className="flex flex-col min-[480px]:flex-row gap-2 min-[480px]:items-center min-[480px]:flex-wrap">
          <Button type="button" size="sm" variant="ghost" className="w-full min-[480px]:w-auto" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? t.auth.needAccount : t.auth.haveAccount}
          </Button>
          {mode === "register" && (
            <Input className="w-full min-[480px]:w-auto" placeholder={t.auth.name} value={name} onChange={(e) => setName(e.currentTarget.value)} />
          )}
          <Input className="w-full min-[480px]:w-auto" placeholder={t.auth.email} value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <Input
            className="w-full min-[480px]:w-auto"
            placeholder={t.auth.password}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button size="sm" type="submit" className="w-full min-[480px]:w-auto">{mode === "login" ? t.auth.login : t.auth.register}</Button>
          {error && <span className="text-destructive text-[13px]">{error}</span>}
          <span className="text-muted-foreground text-[13px]">
            {t.auth.or} <a className="underline" href="/auth/google">Google</a> · <a className="underline" href="/auth/github">GitHub</a>
          </span>
        </form>
      </CardContent>
    </Card>
  );
}

function ShelfButtons({ bookId, current }: { bookId: string; current: ShelfStatus | null }) {
  const t = useT();
  const [setStatus] = useMutation(SET_SHELF_STATUS, {
    refetchQueries: [GET_BOOKS, GET_SHELF, "GetBook"],
  });
  const [remove] = useMutation(REMOVE_FROM_SHELF, {
    refetchQueries: [GET_BOOKS, GET_SHELF, "GetBook"],
  });
  return (
    <span className="inline-flex gap-1 ml-0 min-[480px]:ml-2 flex-wrap">
      <select
        className={selectClass}
        value={current ?? ""}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (!v) return;
          void setStatus({ variables: { bookId, status: v as ShelfStatus } });
        }}
      >
        <option value="">{t.shelfStatus.label}</option>
        {SHELVES.map((s) => (
          <option key={s.value} value={s.value}>
            {t.shelfStatus[s.value]}
          </option>
        ))}
      </select>
      {current && (
        <Button size="sm" variant="ghost" onClick={() => void remove({ variables: { bookId } })}>{t.common.remove}</Button>
      )}
    </span>
  );
}

const SHELVES: { value: ShelfStatus }[] = [
  { value: "want_to_read" },
  { value: "reading" },
  { value: "finished" },
];

function FavButton({ bookId, isFavorite }: { bookId: string; isFavorite: boolean }) {
  const t = useT();
  const [toggle, { loading }] = useMutation(TOGGLE_FAVORITE, {
    refetchQueries: [GET_BOOKS, GET_FAVORITES, "GetBook"],
  });
  return (
    <Button size="sm" variant={isFavorite ? "destructive" : "outline"} disabled={loading} onClick={() => void toggle({ variables: { bookId } })}>
      <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
      {isFavorite ? t.fav.favorited : t.fav.favorite}
    </Button>
  );
}

function BookDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useAuth();
  const t = useT();
  const [reviewSort, setReviewSort] = useState<ReviewSort>("NEWEST");
  const { data, loading, refetch } = useQuery<GetBookQuery, GetBookQueryVariables>(
    GET_BOOK,
    { variables: { id, reviewSort } },
  );
  const [rating, setRating] = useState("5");
  const [text, setText] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [upsertReview] = useMutation(UPSERT_REVIEW);
  const [deleteBook] = useMutation(DELETE_BOOK, { refetchQueries: [GET_BOOKS] });
  const [addTag] = useMutation(ADD_TAG);
  const [removeTag] = useMutation(REMOVE_TAG);

  if (loading) return <p className="text-muted-foreground py-4">{t.common.loading}</p>;
  const book = data?.book;
  if (!book) return <p>{t.bookDetail.notFound}<Button size="sm" variant="outline" onClick={onBack}>{t.common.back}</Button></p>;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="mb-3">
          <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft size={14} /> {t.common.back}</Button>
        </div>
        <div className="grid gap-5 items-start md:grid-cols-[192px_1fr]">
          <div className="w-32 min-[480px]:w-40 md:w-48 shrink-0 max-w-[128px] min-[480px]:max-w-none md:max-w-none">
            {book.coverUrl ? (
              <img src={coverSrc(book.coverUrl) ?? ""} alt={`${book.title} cover`} className="w-full rounded-xl border shadow" />
            ) : (
              <div className="grid place-items-center rounded-xl text-white text-6xl w-full h-[280px] bg-gradient-to-br from-primary to-emerald-700">
                {book.title.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl min-[480px]:text-2xl md:text-3xl font-bold tracking-tight leading-tight break-words">{book.title}</h2>
            <p className="text-muted-foreground mt-1">{t.common.by} {book.author}{book.year ? ` (${book.year})` : ""}</p>
            {book.description && <p className="leading-relaxed mt-3 text-[15px] break-words">{book.description}</p>}
            <p className="mt-3 flex items-center gap-2 flex-wrap"><Stars value={book.averageRating} /> <span className="text-muted-foreground text-sm">· {t.bookDetail.reviewsCount(book.reviewsCount)}</span></p>
            <div className="flex flex-wrap gap-1.5 items-center mt-3">
              {(book.tags ?? []).map((tag) => (
                <Badge key={tag.id} variant="secondary" className="gap-1">
                  #{tag.name}
                  {user && (
                    <button
                      title={t.bookDetail.removeTagTitle(tag.name)}
                      onClick={async () => {
                        await removeTag({ variables: { bookId: book.id, name: tag.name } });
                        await refetch();
                      }}
                    >
                      ×
                    </button>
                  )}
                </Badge>
              ))}
              {user && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setTagError(null);
                    try {
                      await addTag({ variables: { bookId: book.id, name: tagName } });
                      setTagName("");
                      await refetch();
                    } catch (err) {
                      setTagError(err instanceof Error ? err.message : t.common.failed);
                    }
                  }}
                  className="flex flex-col min-[480px]:flex-row gap-1 min-[480px]:ml-2 w-full min-[480px]:w-auto"
                >
                  <Input
                    className="w-full min-[480px]:w-[110px] flex-1 min-w-0"
                    placeholder={t.bookDetail.newTag}
                    value={tagName}
                    onChange={(e) => setTagName(e.currentTarget.value)}
                  />
                  <Button size="sm" variant="outline" type="submit" className="w-full min-[480px]:w-auto">{t.common.add}</Button>
                  {tagError && <span className="text-destructive text-[13px]">{tagError}</span>}
                </form>
              )}
            </div>
            {user && (
              <div className="flex gap-1.5 items-center flex-wrap my-3">
                <FavButton bookId={book.id} isFavorite={book.isFavorite} />
                <ShelfButtons bookId={book.id} current={book.shelfStatus} />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await deleteBook({ variables: { id: book.id } });
                    onBack();
                  }}
                >
                  <Trash2 size={13} /> {t.bookDetail.deleteBook}
                </Button>
                <label className="inline-flex items-center gap-1.5 text-muted-foreground text-[13px] flex-wrap max-w-full [&_input]:max-w-full [&_input]:min-w-0">
                  <ImagePlus size={13} />
                  {t.bookDetail.cover}{" "}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={async (e) => {
                      const file = e.currentTarget.files?.[0];
                      if (!file) return;
                      const token = localStorage.getItem("gql-token");
                      const form = new FormData();
                      form.set("cover", file);
                      const res = await fetch(`${apiBase()}/api/books/${book.id}/cover`, {
                        method: "POST",
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        body: form,
                      });
                      if (res.ok) await refetch();
                      else alert(t.bookDetail.uploadFailed(((await res.json()) as { error?: string }).error ?? String(res.status)));
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
        <h3 className="flex items-center gap-2 my-4 text-lg font-semibold">
          <MessageSquare size={16} className="text-muted-foreground" />
          {t.bookDetail.reviews}
          <Badge variant="secondary">({book.reviewsCount})</Badge>
          <span className="ml-auto inline-flex gap-1.5">
            <Button size="sm" variant="outline" disabled={reviewSort === "NEWEST"} onClick={() => setReviewSort("NEWEST")}>
              {t.bookDetail.newest}
            </Button>
            <Button size="sm" variant="outline" disabled={reviewSort === "TOP"} onClick={() => setReviewSort("TOP")}>
              {t.bookDetail.top}
            </Button>
          </span>
        </h3>
        <ul className="grid gap-3 list-none m-0 p-0">
          {book.reviews.map((r) => (
            <ReviewItem key={r.id} review={r} refetch={refetch} />
          ))}
        </ul>
        {book.reviews.length === 0 && <p className="p-7 text-center text-muted-foreground">{t.bookDetail.noReviews}</p>}
        {user ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await upsertReview({
                variables: { bookId: book.id, rating: Number(rating), text: text || null },
              });
              setText("");
              await refetch();
            }}
            className="flex flex-col min-[480px]:flex-row gap-2 mt-4"
          >
            <select className={selectClass} value={rating} onChange={(e) => setRating(e.currentTarget.value)}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n} ★</option>
              ))}
            </select>
            <Input
              className="flex-1 min-w-0"
              placeholder={t.bookDetail.writeReview}
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
            />
            <Button type="submit" className="w-full min-[480px]:w-auto">{t.bookDetail.postReview}</Button>
          </form>
        ) : (
          <p className="text-muted-foreground mt-3">{t.bookDetail.loginPrompt}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BookDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  if (!id) return <Navigate to="/books" replace />;
  return (
    <BookDetail
      id={id}
      onBack={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate("/books");
      }}
    />
  );
}

function FollowButton({ userId, isFollowing }: { userId: string; isFollowing: boolean }) {
  const { user } = useAuth();
  const t = useT();
  const [follow] = useMutation(FOLLOW_USER);
  const [unfollow] = useMutation(UNFOLLOW_USER);
  const [following, setFollowing] = useState(isFollowing);
  if (!user || user.id === userId) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        if (following) {
          await unfollow({ variables: { userId } });
          setFollowing(false);
        } else {
          await follow({ variables: { userId } });
          setFollowing(true);
        }
      }}
    >
      {following ? <><UserMinus size={13} /> {t.follow.unfollow}</> : <><UserPlus size={13} /> {t.follow.follow}</>}
    </Button>
  );
}

function ReviewItem({
  review,
  refetch,
}: {
  review: {
    id: string;
    rating: number;
    text: string | null;
    likesCount: number;
    likedByMe: boolean;
    commentsCount: number;
    user: { id: string; name: string; isFollowing: boolean };
    comments: {
      id: string;
      text: string;
      user: { id: string; name: string };
    }[];
  };
  refetch: () => Promise<unknown>;
}) {
  const { user } = useAuth();
  const t = useT();
  const [toggleLike] = useMutation(TOGGLE_REVIEW_LIKE);
  const [deleteReview] = useMutation(DELETE_REVIEW);
  const [addComment] = useMutation(ADD_COMMENT);
  const [updateComment] = useMutation(UPDATE_COMMENT);
  const [deleteComment] = useMutation(DELETE_COMMENT);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  return (
    <li className="border rounded-xl bg-card p-3.5 shadow-sm">
      <div className="flex gap-2 items-center flex-wrap text-sm">
        <span className="inline-flex items-center gap-0.5" title={`${review.rating} / 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={12}
              fill={n <= review.rating ? "currentColor" : "none"}
              className={n <= review.rating ? "text-amber-500" : "text-muted-foreground"}
            />
          ))}
        </span>
        <span>{t.reviews.by} <strong>{review.user.name}</strong></span>
        <FollowButton userId={review.user.id} isFollowing={review.user.isFollowing} />
      </div>
      {review.text ? <p className="mt-2 leading-relaxed break-words">{review.text}</p> : null}
      <div className="flex gap-2 mt-2.5 flex-wrap">
        {user ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await toggleLike({ variables: { reviewId: review.id } });
              await refetch();
            }}
          >
            <Heart size={13} fill={review.likedByMe ? "currentColor" : "none"} /> {review.likesCount}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground text-sm"><Heart size={13} /> {review.likesCount}</span>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowComments((v) => !v)}>
          <MessagesSquare size={13} /> {showComments ? t.reviews.hide : t.reviews.show} {t.reviews.comments(review.commentsCount)}
        </Button>
        {user && (
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              await deleteReview({ variables: { id: review.id } });
              await refetch();
            }}
          >
            {t.reviews.deleteReview}
          </Button>
        )}
      </div>
      {showComments && (
        <ul className="list-none mt-2.5 pt-2.5 pl-3 border-l-2 grid gap-2">
          {review.comments.map((c) => (
            <li key={c.id} className="text-sm">
              <strong>{c.user.name}:</strong>{" "}
              {editingId === c.id ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await updateComment({ variables: { id: c.id, text: editText } });
                    setEditingId(null);
                    await refetch();
                  }}
                  className="flex flex-col min-[480px]:flex-row gap-2"
                >
                  <Input
                    className="flex-1 min-w-0"
                    value={editText}
                    onChange={(e) => setEditText(e.currentTarget.value)}
                  />
                  <Button size="sm" type="submit" className="w-full min-[480px]:w-auto">{t.common.save}</Button>
                  <Button size="sm" variant="ghost" type="button" className="w-full min-[480px]:w-auto" onClick={() => setEditingId(null)}>
                    {t.common.cancel}
                  </Button>
                </form>
              ) : (
                <>
                  {c.text}{" "}
                  {user?.id === c.user.id && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditText(c.text);
                        }}
                      >
                        {t.reviews.edit}
                      </Button>{" "}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await deleteComment({ variables: { id: c.id } });
                          await refetch();
                        }}
                      >
                        {t.reviews.delete}
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
          {user ? (
            <li>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!commentText.trim()) return;
                  await addComment({
                    variables: { reviewId: review.id, text: commentText },
                  });
                  setCommentText("");
                  await refetch();
                }}
                className="flex flex-col min-[480px]:flex-row gap-2"
              >
                <Input
                  className="flex-1 min-w-0"
                  placeholder={t.reviews.addComment}
                  value={commentText}
                  onChange={(e) => setCommentText(e.currentTarget.value)}
                />
                <Button size="sm" type="submit" className="w-full min-[480px]:w-auto">{t.reviews.post}</Button>
              </form>
            </li>
          ) : null}
        </ul>
      )}
    </li>
  );
}

export function BooksView({ onOpen }: { onOpen?: (id: string) => void }) {
  const { user } = useAuth();
  const t = useT();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<BookSort>("NEWEST");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { data: tagData } = useQuery<GetTagsQuery>(GET_TAGS, {
    variables: { limit: 50 },
  });
  const filterVars = {
    search: search || null,
    tags: selectedTags.length > 0 ? selectedTags : null,
  };
  const { data, loading, error, fetchMore } = useQuery<GetBooksQuery, GetBooksQueryVariables>(
    GET_BOOKS,
    { variables: { ...filterVars, sort, first: 20 } },
  );
  const [extraEdges, setExtraEdges] = useState<
    NonNullable<GetBooksQuery["booksConnection"]["edges"]>
  >([]);
  const [lastPageInfo, setLastPageInfo] = useState<
    GetBooksQuery["booksConnection"]["pageInfo"] | null
  >(null);
  // Filters change the result set — drop accumulated pages.
  const resetPages = () => {
    setExtraEdges([]);
    setLastPageInfo(null);
  };
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [addBook] = useMutation(ADD_BOOK, { refetchQueries: [GET_BOOKS] });
  const open = onOpen ?? (() => {});

  const connection = data?.booksConnection;
  const books = [
    ...(connection?.edges ?? []),
    ...extraEdges.filter(
      (e) => !(connection?.edges ?? []).some((base) => base.cursor === e.cursor),
    ),
  ].map((e) => e.node);
  const pageInfo = lastPageInfo ?? connection?.pageInfo;

  const loadMore = async () => {
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) return;
    const res = await fetchMore({ variables: { after: pageInfo.endCursor } });
    setExtraEdges((prev) => {
      const seen = new Set([
        ...(connection?.edges ?? []).map((e) => e.cursor),
        ...prev.map((e) => e.cursor),
      ]);
      const fresh = res.data.booksConnection.edges.filter((e) => !seen.has(e.cursor));
      return [...prev, ...fresh];
    });
    setLastPageInfo(res.data.booksConnection.pageInfo);
  };

  const countLabel = t.books.count(
    connection?.totalCount ?? 0,
    selectedTags.length > 0 || search !== "",
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LibraryBig size={18} className="text-primary" /> {t.books.title}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{t.books.subtitle}</p>
        </div>
        {!loading && !error && <Badge variant="secondary" className="mt-1 shrink-0">{countLabel}</Badge>}
      </div>
      <Card className="mb-3 shadow-sm">
        <CardContent className="p-3 flex flex-col min-[480px]:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              className="flex-1 pl-8"
              placeholder={t.books.searchPlaceholder}
              value={search}
              onChange={(e) => { setSearch(e.currentTarget.value); resetPages(); }}
            />
          </div>
          <select className={cn(selectClass, "w-full min-[480px]:w-auto")} value={sort} onChange={(e) => { setSort(e.currentTarget.value as BookSort); resetPages(); }}>
            <option value="NEWEST">{t.books.sortNewest}</option>
            <option value="RATING">{t.books.sortRating}</option>
            <option value="TITLE">{t.books.sortTitle}</option>
            <option value="AUTHOR">{t.books.sortAuthor}</option>
          </select>
        </CardContent>
      </Card>
      <div className="flex gap-1.5 flex-wrap mb-3.5">
        {(tagData?.tags ?? []).map((tag) => {
          const active = selectedTags.includes(tag.name);
          return (
            <button
              key={tag.id}
              className={cn(
                "border rounded-full px-2.5 py-1 text-[13px] cursor-pointer",
                active ? "bg-primary text-primary-foreground border-primary font-bold" : "bg-card text-muted-foreground",
              )}
              onClick={() => {
                setSelectedTags((prev) =>
                  active ? prev.filter((x) => x !== tag.name) : [...prev, tag.name],
                );
                resetPages();
              }}
              title={t.books.tagTitle(tag.booksCount)}
            >
              #{tag.name}{active ? " ×" : ""}
            </button>
          );
        })}
      </div>
      {user && (
        <Card className="mb-4 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.books.addTitle}</CardTitle>
            <CardDescription>{t.books.addSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!title.trim() || !author.trim()) return;
                await addBook({
                  variables: {
                    title: title.trim(),
                    author: author.trim(),
                    year: year ? Number(year) : null,
                    description: description.trim() || null,
                  },
                });
                setTitle("");
                setAuthor("");
                setYear("");
                setDescription("");
              }}
              className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2 border border-dashed rounded-xl p-3 lg:grid-cols-[1.2fr_1fr_90px_1fr_auto]"
            >
              <Input placeholder={t.books.titlePh} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
              <Input placeholder={t.books.authorPh} value={author} onChange={(e) => setAuthor(e.currentTarget.value)} />
              <Input placeholder={t.books.yearPh} value={year} inputMode="numeric" onChange={(e) => setYear(e.currentTarget.value)} />
              <Input placeholder={t.books.descriptionPh} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
              <Button type="submit" className="w-full min-[480px]:w-auto">{t.books.addBook}</Button>
            </form>
          </CardContent>
        </Card>
      )}
      {loading && <p className="text-muted-foreground py-4">{t.common.loading}</p>}
      {error && <p className="text-destructive bg-destructive/10 border p-2.5 rounded-md">{t.common.errorPrefix}{error.message}</p>}
      {!loading && !error && books.length === 0 ? (
        <Card className="mt-2">
          <CardContent className="p-7 text-center text-muted-foreground flex flex-col items-center gap-2">
            <LibraryBig size={22} className="text-muted-foreground" />
            <p>{t.books.noResults}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="list-none m-0 p-0 grid gap-4 sm:grid-cols-2">
          {books.map((b) => (
            <li key={b.id} className="flex gap-3 items-start bg-card border rounded-xl p-3 sm:p-3.5 shadow-sm hover:shadow-md hover:border-primary/30 transition-shadow">
              {b.coverUrl ? (
                <img
                  src={coverSrc(b.coverUrl) ?? ""}
                  alt=""
                  className="w-14 h-20 sm:w-16 sm:h-24 object-cover rounded-md border shrink-0"
                />
              ) : (
                <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-md bg-gradient-to-br from-primary to-emerald-700 text-white grid place-items-center text-xl shrink-0">{b.title.charAt(0)}</div>
              )}
              <div className="flex-1 min-w-0">
                <button onClick={() => open(b.id)} className="bg-transparent border-0 p-0 font-semibold text-[15px] leading-snug cursor-pointer text-left hover:underline break-words">
                  {b.title}
                </button>
                <span className="inline-flex gap-1.5 ml-2 align-middle">
                  {b.isFavorite ? <Badge variant="destructive" className="gap-1"><Heart size={12} fill="currentColor" /> {t.fav.badge}</Badge> : null}
                  {b.shelfStatus ? <Badge variant="secondary">{t.shelfStatus[b.shelfStatus]}</Badge> : null}
                </span>
                <div className="text-sm text-muted-foreground mt-1">
                  {t.common.by} {b.author} · <Stars value={b.averageRating} /> ({b.reviewsCount})
                </div>
                {b.tags.length > 0 && (
                  <div className="text-[13px] text-muted-foreground truncate mt-0.5">
                    {b.tags.map((t) => `#${t.name}`).join(" ")}
                  </div>
                )}
                {user && (
                  <div className="flex gap-1.5 items-center mt-2 flex-wrap">
                    <FavButton bookId={b.id} isFavorite={b.isFavorite} />
                    <ShelfButtons bookId={b.id} current={b.shelfStatus} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && pageInfo?.hasNextPage && (
        <div className="flex justify-center mt-2">
          <Button onClick={loadMore}>{t.books.loadMore}</Button>
        </div>
      )}
    </div>
  );
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

interface ImportRow {
  title: string;
  author: string;
  year?: number | null;
  shelf?: "want_to_read" | "reading" | "finished" | null;
  rating?: number | null;
}

export function goodreadsToRows(text: string): { rows: ImportRow[]; skipped: number } {
  const grid = parseCsv(text);
  if (grid.length === 0) return { rows: [], skipped: 0 };
  const header = (grid[0] ?? []).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const iTitle = col("Title");
  const iAuthor = col("Author");
  if (iTitle < 0 || iAuthor < 0) return { rows: [], skipped: grid.length - 1 };
  const iRating = col("My Rating");
  const iShelf = col("Exclusive Shelf");
  const iYear = col("Original Publication Year");
  const shelfMap: Record<string, ImportRow["shelf"]> = {
    read: "finished",
    "currently-reading": "reading",
    "to-read": "want_to_read",
  };
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const line of grid.slice(1)) {
    const title = (line[iTitle] ?? "").trim();
    const author = (line[iAuthor] ?? "").trim();
    if (!title || !author) {
      skipped++;
      continue;
    }
    const ratingRaw = iRating >= 0 ? Number(line[iRating]) : 0;
    const yearRaw = iYear >= 0 ? Number(line[iYear]) : 0;
    rows.push({
      title,
      author,
      year: Number.isInteger(yearRaw) && yearRaw > 0 ? yearRaw : null,
      shelf: iShelf >= 0 ? (shelfMap[(line[iShelf] ?? "").trim()] ?? null) : null,
      rating: Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null,
    });
  }
  return { rows, skipped };
}

function ImportView() {
  const { user } = useAuth();
  const t = useT();
  const [preview, setPreview] = useState<{ rows: ImportRow[]; skipped: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [importBooks, { loading }] = useMutation(IMPORT_BOOKS, {
    refetchQueries: [GET_BOOKS],
  });
  const [fetchExport, { loading: exporting }] = useLazyQuery(EXPORT_DATA);
  const [fetchCsv, { loading: exportingCsv }] = useLazyQuery(EXPORT_CSV);
  if (!user) return <Card><CardContent className="p-4">{t.importView.loginRequired}</CardContent></Card>;

  const download = (raw: string, filename: string, mime: string) => {
    const blob = new Blob([raw], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Upload size={18} className="text-primary" /> {t.importView.title}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{t.importView.subtitle}</p>
      </div>
      <div className="grid gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.importView.exportTab}</CardTitle>
            <CardDescription>{t.importView.exportTitle}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              disabled={exporting}
              onClick={async () => {
                const res = await fetchExport();
                const raw = res.data?.exportData;
                if (!raw) return;
                download(raw, "bookshelf-export.json", "application/json");
              }}
            >
              <Download size={14} /> {exporting ? t.importView.exporting : t.importView.exportButton}
            </Button>
            <Button
              variant="outline"
              disabled={exportingCsv}
              onClick={async () => {
                const res = await fetchCsv();
                const raw = res.data?.exportCsv;
                if (!raw) return;
                download(raw, "bookshelf-goodreads.csv", "text/csv");
              }}
            >
              <Download size={14} /> {exportingCsv ? t.importView.exporting : t.importView.exportCsvButton}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Upload size={16} /> {t.importView.importTitle}</CardTitle>
            <CardDescription>
              {t.importView.importHelp}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 grid gap-3">
            <label className="flex flex-col min-[480px]:flex-row min-[480px]:items-center gap-2 text-sm min-w-0">
              <FileUp size={14} className="text-muted-foreground shrink-0" />
              <input
                type="file"
                accept=".csv,text/csv"
                className="max-w-full min-w-0 text-sm"
                onChange={async (e) => {
                  const file = e.currentTarget.files?.[0];
                  if (!file) return;
                  setPreview(goodreadsToRows(await file.text()));
                  setResult(null);
                }}
              />
            </label>
            {preview && (
              <div className="grid gap-2">
                <p className="text-sm">
                  {t.importView.ready(preview.rows.length)}
                  {preview.skipped > 0 ? t.importView.skipped(preview.skipped) : ""}
                </p>
                <ul className="list-none m-0 p-0 grid gap-2">
                  {preview.rows.slice(0, 5).map((r, i) => (
                    <li className="bg-card border rounded-md px-3 py-2 text-sm" key={i}>
                      {r.title} by {r.author}
                    </li>
                  ))}
                </ul>
                {preview.rows.length > 5 && <p className="text-muted-foreground text-sm">{t.importView.andMore(preview.rows.length - 5)}</p>}
                <div>
                  <Button
                    className="w-full min-[480px]:w-auto"
                    disabled={loading || preview.rows.length === 0}
                    onClick={async () => {
                      const res = await importBooks({ variables: { books: preview.rows } });
                      const r = res.data?.importBooks;
                      if (!r) return;
                      setResult(
                        t.importView.result(r) +
                          (r.errors.length > 0 ? t.importView.resultErrors(r.errors.slice(0, 3).join("; ")) : ""),
                      );
                      setPreview(null);
                    }}
                  >
                    <Upload size={14} /> {loading ? t.importView.importing : t.importView.importButton(preview.rows.length)}
                  </Button>
                </div>
              </div>
            )}
            {result && <p className="text-sm">{result}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsChart() {
  const { user } = useAuth();
  const t = useT();
  const year = new Date().getFullYear();
  const { data } = useQuery<GetStatsQuery>(GET_STATS, {
    skip: !user,
    variables: { year },
  });
  if (!user) return null;
  const months = data?.readingStats ?? [];
  const max = Math.max(1, ...months.map((m) => m.finished));
  return (
    <Card className="mb-3.5 shadow-sm">
      <CardContent className="p-3.5">
        <div className="text-sm font-medium mb-2">{t.shelf.statsTitle(year)}</div>
        <div className="flex items-end gap-1 h-20" role="img" aria-label={t.shelf.statsTitle(year)}>
          {months.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${m.finished}`}>
              <div
                className="w-full rounded-sm bg-primary"
                style={{ height: `${Math.max(3, Math.round((m.finished / max) * 64))}px` }}
              />
              <span className="text-[10px] text-muted-foreground">{m.month}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


export function SettingsView() {  const { user } = useAuth();
  const t = useT();
  const { data: prefsData, refetch: refetchPrefs } = useQuery<GetPrefsQuery>(GET_PREFS, {
    skip: !user,
  });
  const [updateProfile] = useMutation(UPDATE_PROFILE);
  const [changePassword] = useMutation(CHANGE_PASSWORD);
  const [setPrefs] = useMutation(SET_PREFS);
  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (!user) return <Card><CardContent className="p-4">{t.settings.loginRequired}</CardContent></Card>;
  const prefs = prefsData?.myNotificationPrefs;

  const togglePref = async (key: "follow" | "like" | "comment", value: boolean) => {
    await setPrefs({ variables: { [key]: value } });
    await refetchPrefs();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings size={18} className="text-primary" /> {t.settings.title}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{t.settings.subtitle}</p>
      </div>
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.settings.profileTitle}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg(null);
              try {
                await updateProfile({ variables: { name } });
                setName("");
                window.location.reload();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : t.common.failed);
              }
            }}
            className="flex flex-col min-[480px]:flex-row gap-2"
          >
            <Input
              placeholder={t.settings.namePh}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <Button type="submit" className="w-full min-[480px]:w-auto">{t.settings.saveName}</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.settings.passwordTitle}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid gap-2">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg(null);
              try {
                const res = await changePassword({
                  variables: { currentPassword: current, newPassword: next },
                });
                const pair = res.data?.changePassword;
                if (!pair) throw new Error(t.common.failed);
                localStorage.setItem("gql-token", pair.token);
                localStorage.setItem("gql-refresh", pair.refreshToken);
                setCurrent("");
                setNext("");
                setMsg(t.settings.passwordChanged);
              } catch (err) {
                setMsg(err instanceof Error ? err.message : t.common.failed);
              }
            }}
            className="flex flex-col min-[480px]:flex-row gap-2"
          >
            <Input
              placeholder={t.settings.currentPh}
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.currentTarget.value)}
            />
            <Input
              placeholder={t.settings.newPh}
              type="password"
              value={next}
              onChange={(e) => setNext(e.currentTarget.value)}
            />
            <Button type="submit" className="w-full min-[480px]:w-auto">{t.settings.changePassword}</Button>
          </form>
          {msg && <p className="text-sm">{msg}</p>}
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.settings.prefsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid gap-2">
          {(
            [
              ["follow", t.settings.prefFollow],
              ["like", t.settings.prefLike],
              ["comment", t.settings.prefComment],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs?.[key] ?? true}
                onChange={(e) => void togglePref(key, e.currentTarget.checked)}
              />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


function GoalWidget() {
  const { user } = useAuth();
  const t = useT();
  const year = new Date().getFullYear();
  const { data, refetch } = useQuery<GetGoalsQuery>(GET_GOALS, { skip: !user });
  const [setGoal] = useMutation(SET_GOAL);
  const [target, setTarget] = useState("12");
  if (!user) return null;
  const goal = (data?.myGoals ?? []).find((g) => g.year === year);
  if (!goal) {
    return (
      <Card className="mb-3 shadow-sm">
        <CardContent className="p-3">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const n = Number(target);
              if (!Number.isInteger(n) || n < 1) return;
              await setGoal({ variables: { year, target: n } });
              await refetch();
            }}
            className="flex flex-col min-[480px]:flex-row gap-2 min-[480px]:items-center flex-wrap"
          >
            <span className="inline-flex items-center gap-1.5 text-sm font-medium"><Target size={16} /> {t.goals.prompt(year)}</span>
            <Input
              value={target}
              inputMode="numeric"
              className="w-full min-[480px]:w-[70px]"
              onChange={(e) => setTarget(e.currentTarget.value)}
            />
            <Button size="sm" type="submit" className="w-full min-[480px]:w-auto">{t.goals.setGoal}</Button>
          </form>
        </CardContent>
      </Card>
    );
  }
  const pct = Math.min(100, Math.round((goal.finishedCount / goal.target) * 100));
  return (
    <Card className="mb-3.5 shadow bg-primary text-primary-foreground border-primary">
      <CardContent className="flex gap-2.5 items-center rounded-xl p-3.5">
        <Target size={16} className="shrink-0" />
        <span className="text-sm">{t.goals.line(year, goal.finishedCount, goal.target, pct)}</span>
        <div className="flex-1 h-2 min-w-[80px] rounded-full bg-primary-foreground/25 overflow-hidden">
          <div className="h-full rounded-full bg-primary-foreground transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium">
          {goal.complete ? <><Trophy size={14} /> {t.goals.complete}</> : t.goals.remaining(goal.remaining)}
        </span>
      </CardContent>
    </Card>
  );
}

export function ShelfView({ onOpen }: { onOpen?: (id: string) => void }) {
  const { user } = useAuth();
  const t = useT();
  const { data, loading, refetch } = useQuery<GetShelfQuery>(GET_SHELF, { skip: !user });
  const [updateProgress] = useMutation(UPDATE_PROGRESS);
  const open = onOpen ?? (() => {});
  if (!user) return <Card><CardContent className="p-4">{t.shelf.loginRequired}</CardContent></Card>;
  if (loading) return <p className="text-muted-foreground py-4">{t.common.loading}</p>;
  const statusIcon = (status: ShelfStatus) =>
    status === "want_to_read" ? <Bookmark size={14} className="text-muted-foreground" />
    : status === "reading" ? <BookOpen size={14} className="text-muted-foreground" />
    : <CheckCircle2 size={14} className="text-muted-foreground" />;
  const groups = SHELVES.map((s) => ({
    ...s,
    items: (data?.myShelf ?? []).filter((i) => i.status === s.value),
  }));
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Layers size={18} className="text-primary" /> {t.shelf.title}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{t.shelf.subtitle}</p>
      </div>
      <GoalWidget />
      <StatsChart />
      {groups.map((g) => (
        <section key={g.value} className="mb-4">
          <div className="flex items-center gap-2 my-4">
            {statusIcon(g.value)}
            <h3 className="text-[13px] uppercase tracking-widest text-muted-foreground m-0">{t.shelfStatus[g.value]}</h3>
            <Badge variant="secondary">{g.items.length}</Badge>
          </div>
          {g.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.shelf.empty}</p>
          ) : null}
          <div className="grid gap-2">
            {g.items.map((i) => (
              <Card key={i.id} className="shadow-sm">
                <CardContent className="flex gap-2.5 items-center flex-wrap px-3 py-2.5">
                  <button onClick={() => open(i.book.id)} className="bg-transparent border-0 p-0 font-bold text-base cursor-pointer text-left hover:underline break-words min-w-0">{i.book.title}</button>
                  <span className="text-muted-foreground text-sm">by {i.book.author}</span>
                  <Stars value={i.book.averageRating} />
                  <span className="flex items-center gap-2 flex-wrap min-w-0">
                    <progress className="w-[110px]" value={i.progress} max={100} />{" "}
                    {i.progress}%
                    <span className="inline-flex gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await updateProgress({
                            variables: {
                              bookId: i.book.id,
                              progress: Math.max(0, i.progress - 10),
                            },
                          });
                          await refetch();
                        }}
                      >
                        <Minus size={12} /> −10
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await updateProgress({
                            variables: {
                              bookId: i.book.id,
                              progress: Math.min(100, i.progress + 10),
                            },
                          });
                          await refetch();
                        }}
                      >
                        <Plus size={12} /> +10
                      </Button>
                    </span>
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function NotificationBell({ onOpenBook }: { onOpenBook: (id: string) => void }) {
  const { user } = useAuth();
  const t = useT();
  const [open, setOpen] = useState(false);
  const { data: countData, refetch: refetchCount } = useQuery<GetUnreadCountQuery>(
    GET_UNREAD_COUNT,
    { skip: !user, pollInterval: 30000 },
  );
  const { data, refetch } = useQuery<GetNotificationsQuery>(GET_NOTIFICATIONS, {
    skip: !user || !open,
    variables: { limit: 20 },
  });
  const [markRead] = useMutation(MARK_READ);
  const [markAll] = useMutation(MARK_ALL_READ);
  if (!user) return null;
  const unread = countData?.unreadNotificationsCount ?? 0;

  const textFor = (type: NotificationType, name: string, title?: string | null) => {
    if (type === "FOLLOW") return t.notifications.follow(name);
    if (type === "REVIEW_LIKE") return t.notifications.like(name, title);
    return t.notifications.comment(name, title);
  };

  const iconFor = (t: NotificationType) =>
    t === "FOLLOW" ? <UserPlus size={14} className="text-muted-foreground shrink-0" />
    : t === "REVIEW_LIKE" ? <Heart size={14} className="text-muted-foreground shrink-0" />
    : <MessageSquare size={14} className="text-muted-foreground shrink-0" />;

  const refresh = () => {
    void refetch();
    void refetchCount();
  };

  return (
    <span className="relative inline-flex items-center gap-2">
      <Button size="sm" variant="outline" className="relative min-h-9 min-w-9" onClick={() => { setOpen((v) => !v); if (!open) void refetch(); }}>
        <Bell size={16} />{unread > 0 ? ` (${unread})` : ""}
        {unread > 0 && <span className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white text-[11px] font-extrabold min-w-[18px] h-[18px] rounded-full grid place-items-center px-1">{unread}</span>}
      </Button>
      {open && (
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await markAll();
            refresh();
          }}
        >
          {t.notifications.markAllRead}
        </Button>
      )}
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-[min(360px,86vw)] bg-card border rounded-xl shadow-xl p-2.5 z-30">
          <div className="flex items-center gap-2 px-1.5 pb-2">
            <Bell size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold">{t.notifications.title}</span>
          </div>
          <ul className="list-none m-0 p-0 grid gap-1">
            {(data?.myNotifications ?? []).map((n) => (
              <li key={n.id} className={cn("flex items-start gap-2 p-2 rounded-lg text-sm", !n.readAt && "bg-amber-100 font-semibold")}>
                <span className="mt-0.5">{iconFor(n.type)}</span>
                <span className="flex-1">
                  {textFor(n.type, n.actor.name, n.book?.title)}{" "}
                  {n.book && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!n.readAt) {
                          await markRead({ variables: { id: n.id } });
                          refresh();
                        }
                        onOpenBook(n.book!.id);
                      }}
                    >
                      {t.common.view}
                    </Button>
                  )}
                </span>
              </li>
            ))}
            {(data?.myNotifications ?? []).length === 0 && <li className="text-sm text-muted-foreground px-1.5 py-1">{t.notifications.empty}</li>}
          </ul>
        </div>
      )}
    </span>
  );
}

export function ForYouView({ onOpen }: { onOpen?: (id: string) => void }) {
  const { user } = useAuth();
  const t = useT();
  const { data, loading } = useQuery<GetRecommendationsQuery>(GET_RECOMMENDATIONS, {
    skip: !user,
    variables: { limit: 10 },
  });
  const open = onOpen ?? (() => {});
  if (!user) return <Card><CardContent className="p-4">{t.foryou.loginRequired}</CardContent></Card>;
  if (loading) return <p className="text-muted-foreground py-4">{t.common.loading}</p>;
  const recs = data?.recommendations ?? [];
  if (recs.length === 0) return <p className="p-7 text-center text-muted-foreground">{t.foryou.empty}</p>;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles size={18} className="text-primary" /> {t.foryou.title}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{t.foryou.subtitle}</p>
      </div>
      <ul className="list-none m-0 p-0 grid gap-2.5">
        {recs.map((r) => (
          <li key={r.book.id} className="flex gap-3.5 items-start bg-card border rounded-xl p-3 sm:p-3.5 shadow-sm">
            <div className="flex-1 min-w-0">
              <button onClick={() => open(r.book.id)} className="bg-transparent border-0 p-0 font-bold text-base cursor-pointer text-left hover:underline break-words">
                {r.book.title}
              </button>
              <div className="text-sm text-muted-foreground mt-1">
                {t.common.by} {r.book.author} · <Stars value={r.book.averageRating} />
              </div>
              <div className="text-muted-foreground text-[13px] mt-1.5 flex items-start gap-1.5">
                <Sparkles size={12} className="mt-0.5 shrink-0" />
                <span>{r.reason}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeedView({ onOpen }: { onOpen?: (id: string) => void }) {
  const { user } = useAuth();
  const t = useT();
  const { data, loading } = useQuery<GetFeedQuery>(GET_FEED, {
    skip: !user,
    variables: { limit: 30 },
  });
  const open = onOpen ?? (() => {});
  if (!user) return <Card><CardContent className="p-4">{t.feed.loginRequired}</CardContent></Card>;
  if (loading) return <p className="text-muted-foreground py-4">{t.common.loading}</p>;
  const items = data?.activityFeed ?? [];
  if (items.length === 0) return <p className="p-7 text-center text-muted-foreground">{t.feed.empty}</p>;
  const textFor = (type: ActivityType, title: string, extra?: string | null) => {
    if (type === "REVIEW") return t.feed.reviewed(title, extra ?? "");
    if (type === "FAVORITE") return t.feed.favorited(title);
    return t.feed.shelfUpdate(title, extra);
  };
  const iconFor = (t: ActivityType) =>
    t === "REVIEW" ? <Star size={14} className="text-muted-foreground shrink-0" />
    : t === "FAVORITE" ? <Heart size={14} className="text-muted-foreground shrink-0" />
    : <Layers size={14} className="text-muted-foreground shrink-0" />;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Activity size={18} className="text-primary" /> {t.feed.title}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{t.feed.subtitle}</p>
      </div>
      <ul className="list-none m-0 p-0 grid gap-2">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2.5 bg-card border rounded-xl px-3 py-2.5 text-sm shadow-sm min-w-0">
            <span className="mt-0.5 shrink-0">{iconFor(i.type)}</span>
            <span className="flex-1 min-w-0 break-words">
              <strong>{i.user.name}</strong>{" "}
              {textFor(
                i.type,
                i.book.title,
                i.type === "REVIEW" ? String(i.review?.rating ?? "") : i.shelfStatus,
              )}{" "}
            </span>
            <Button size="sm" variant="outline" onClick={() => open(i.book.id)}>{t.feed.viewBook} <ArrowRight size={12} /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FavoritesView({ onOpen }: { onOpen?: (id: string) => void }) {
  const { user } = useAuth();
  const t = useT();
  const { data, loading } = useQuery<GetFavoritesQuery>(GET_FAVORITES, { skip: !user });
  const open = onOpen ?? (() => {});
  if (!user) return <Card><CardContent className="p-4">{t.favorites.loginRequired}</CardContent></Card>;
  if (loading) return <p className="text-muted-foreground py-4">{t.common.loading}</p>;
  if ((data?.myFavorites ?? []).length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Heart size={18} className="text-primary" /> {t.favorites.title}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{t.favorites.subtitle}</p>
        </div>
        <Card>
          <CardContent className="p-7 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Heart size={22} className="text-muted-foreground" />
            <p>{t.favorites.empty}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Heart size={18} className="text-primary" /> {t.favorites.title}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{t.favorites.subtitle}</p>
      </div>
      <ul className="list-none m-0 p-0 grid gap-2.5">
        {(data?.myFavorites ?? []).map((b) => (
          <li key={b.id} className="flex gap-3.5 items-start bg-card border rounded-xl p-3 sm:p-3.5 shadow-sm">
            <div className="flex-1 min-w-0">
              <button onClick={() => open(b.id)} className="bg-transparent border-0 p-0 font-bold text-base cursor-pointer text-left hover:underline break-words">{b.title}</button>
              <div className="text-sm text-muted-foreground mt-1">{t.common.by} {b.author} · <Stars value={b.averageRating} /></div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Routed wrappers: provide default onOpen via useNavigate so views stay router-free for tests.
function BooksRoute() {
  const navigate = useNavigate();
  return <BooksView onOpen={(id) => navigate(`/book/${id}`)} />;
}
function ShelfRoute() {
  const navigate = useNavigate();
  return <ShelfView onOpen={(id) => navigate(`/book/${id}`)} />;
}
function FavoritesRoute() {
  const navigate = useNavigate();
  return <FavoritesView onOpen={(id) => navigate(`/book/${id}`)} />;
}
function FeedRoute() {
  const navigate = useNavigate();
  return <FeedView onOpen={(id) => navigate(`/book/${id}`)} />;
}
function ForYouRoute() {
  const navigate = useNavigate();
  return <ForYouView onOpen={(id) => navigate(`/book/${id}`)} />;
}

const TABS: { value: string; labelKey: keyof Dict["nav"]; to: string; icon: typeof BookOpen }[] = [
  { value: "books", labelKey: "books", to: "/books", icon: BookOpen },
  { value: "shelf", labelKey: "shelf", to: "/shelf", icon: Layers },
  { value: "favorites", labelKey: "favorites", to: "/favorites", icon: Heart },
  { value: "feed", labelKey: "feed", to: "/feed", icon: Activity },
  { value: "foryou", labelKey: "foryou", to: "/foryou", icon: Sparkles },
  { value: "import", labelKey: "import", to: "/import", icon: ArrowLeftRight },
  { value: "settings", labelKey: "settings", to: "/settings", icon: Settings },
];

function LangSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <span className="inline-flex rounded-md border overflow-hidden" role="group" aria-label="Language">
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          disabled={lang === l}
          className={
            lang === l
              ? "px-2 py-1 text-xs font-bold bg-primary text-primary-foreground"
              : "px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          }
        >
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}

function Shell() {
  const navigate = useNavigate();
  const { t } = useLang();
  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      <div className="mx-auto flex max-w-6xl items-start gap-6 px-4 pb-24 md:pb-16 sm:px-6">
        <aside className="hidden md:flex w-60 shrink-0 flex-col gap-4 sticky top-0 h-screen py-6">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg grid place-items-center bg-primary text-primary-foreground"><LibraryBig size={18} /></span>
            <span className="text-xl font-bold tracking-tight">Bookshelf<small className="block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{t.appTagline}</small></span>
          </div>
          <nav className="flex flex-col gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.value}
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )
                  }
                >
                  <Icon size={16} />
                  {t.nav[tab.labelKey]}
                </NavLink>
              );
            })}
          </nav>
          <Card className="mt-auto shadow-sm">
            <CardContent className="p-3.5 text-[13px] text-muted-foreground leading-relaxed">
              {t.sidebarTip}
            </CardContent>
          </Card>
        </aside>
        <div className="min-w-0 flex-1 py-6">
          <div className="sticky top-0 z-20 -mx-4 px-4 py-2.5 bg-background/95 backdrop-filter border-b sm:-mx-6 sm:px-6 flex items-center gap-3">
            <span className="md:hidden flex items-center gap-2 text-sm font-bold tracking-tight min-w-0">
              <span className="w-8 h-8 rounded-lg grid place-items-center bg-primary text-primary-foreground shrink-0"><LibraryBig size={16} /></span>
              <span className="truncate">Bookshelf</span>
              <small className="hidden min-[420px]:block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{t.appTagline}</small>
            </span>
            <span className="ml-auto inline-flex shrink-0 items-center gap-2">
              <LangSwitcher />
              <NotificationBell onOpenBook={(id) => navigate(`/book/${id}`)} />
            </span>
          </div>
          <AuthPanel />
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="grid grid-cols-7 gap-0.5 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.value}
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-medium leading-none text-center",
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground",
                    )
                  }
                >
                  <Icon size={20} />
                  {t.nav[tab.labelKey]}
                </NavLink>
              );
            })}
            </div>
          </nav>
          <div className="pt-4">
          <Routes>
            <Route path="/" element={<Navigate to="/books" replace />} />
            <Route path="/books" element={<BooksRoute />} />
            <Route path="/shelf" element={<ShelfRoute />} />
            <Route path="/favorites" element={<FavoritesRoute />} />
            <Route path="/feed" element={<FeedRoute />} />
            <Route path="/foryou" element={<ForYouRoute />} />
            <Route path="/import" element={<ImportView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/book/:id" element={<BookDetailRoute />} />
            <Route path="*" element={<Navigate to="/books" replace />} />
          </Routes>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
