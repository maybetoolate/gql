import { useState } from "react";
import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  ADMIN_AUDIT,
  ADMIN_BOOKS,
  ADMIN_DELETE_BOOK,
  ADMIN_LOGIN,
  ADMIN_ME,
  ADMIN_STATS,
  ADMIN_USERS,
  DELETE_USER,
  MERGE_BOOKS,
  SET_ROLE,
} from "./queries";
import { ACCESS_KEY, REFRESH_KEY } from "./apollo-client";
import { useLang, useT } from "./i18n";
import type { Dict } from "./i18n";
import type {
  AdminAuditQuery,
  AdminBooksQuery,
  AdminBooksQueryVariables,
  AdminMeQuery,
  AdminStatsQuery,
  AdminUsersQuery,
  AdminUsersQueryVariables,
} from "./types/__generated__/graphql";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Heart,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessagesSquare,
  ScrollText,
  Search,
  ShieldCheck,
  Star,
  Tags,
  Trash2,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";

function Login({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [doLogin] = useMutation(ADMIN_LOGIN);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          const res = await doLogin({ variables: { email, password } });
          const pair = res.data?.login;
          if (!pair) throw new Error(t.login.failed);
          if (pair.user.role !== "admin") {
            setError(t.login.notAdmin);
            return;
          }
          localStorage.setItem(ACCESS_KEY, pair.token);
          localStorage.setItem(REFRESH_KEY, pair.refreshToken);
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : t.login.failed);
        }
      }}
      className="grid gap-2"
    >
      <Input placeholder={t.login.email} value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
      <Input
        placeholder={t.login.password}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
      />
      <Button type="submit" className="flex items-center gap-1.5">
        <LogIn size={14} />
        {t.login.submit}
      </Button>
      {error && (
        <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[13px] text-destructive">
          {error}
        </span>
      )}
    </form>
  );
}

function Dashboard() {
  const t = useT();
  const { data, loading, error } = useQuery<AdminStatsQuery>(ADMIN_STATS);
  if (loading) return <p className="text-muted-foreground">{t.common.loading}</p>;
  if (error) return <p className="text-destructive">{t.common.errorPrefix}{error.message}</p>;
  const s = data?.adminStats;
  if (!s) return null;
  const cards: { key: "users" | "books" | "reviews" | "comments" | "shelf" | "favorites" | "follows" | "tags"; value: number; Icon: typeof UsersIcon }[] = [
    { key: "users", value: s.userCount, Icon: UsersIcon },
    { key: "books", value: s.bookCount, Icon: BookOpen },
    { key: "reviews", value: s.reviewCount, Icon: Star },
    { key: "comments", value: s.commentCount, Icon: MessagesSquare },
    { key: "shelf", value: s.shelfCount, Icon: Layers },
    { key: "favorites", value: s.favoriteCount, Icon: Heart },
    { key: "follows", value: s.followCount, Icon: UserPlus },
    { key: "tags", value: s.tagCount, Icon: Tags },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t.dashboard.title}</h2>
          <p className="text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ key, value, Icon }) => (
          <Card key={key}>
            <CardContent className="space-y-1 p-4">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-muted text-muted-foreground">
                <Icon size={16} />
              </span>
              <div className="text-2xl font-extrabold tracking-tight">{value}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.dashboard[key]}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Users() {
  const t = useT();
  const [search, setSearch] = useState("");
  const { data, loading, refetch } = useQuery<AdminUsersQuery, AdminUsersQueryVariables>(
    ADMIN_USERS,
    { variables: { search: search || null, limit: 50 } },
  );
  const [setRole] = useMutation(SET_ROLE);
  const [deleteUser] = useMutation(DELETE_USER);
  const users = data?.users ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t.users.title}</h2>
          <p className="text-sm text-muted-foreground">
            {t.users.subtitle}
          </p>
        </div>
        <Badge variant="secondary">
          {t.users.count(users.length)}
        </Badge>
      </div>
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder={t.users.search}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="pl-8"
        />
      </div>
      {loading && <p className="text-muted-foreground">{t.common.loading}</p>}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.users.email}</TableHead>
                <TableHead>{t.users.name}</TableHead>
                <TableHead>{t.users.role}</TableHead>
                <TableHead>{t.users.followers}</TableHead>
                <TableHead>{t.users.following}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                      <select
                        className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={u.role}
                        onChange={async (e) => {
                          await setRole({
                            variables: { userId: u.id, role: e.currentTarget.value },
                          });
                          await refetch();
                        }}
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                  </TableCell>
                  <TableCell>{u.followersCount}</TableCell>
                  <TableCell>{u.followingCount}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex items-center gap-1.5"
                      onClick={async () => {
                        if (!window.confirm(t.users.confirmDelete(u.email))) return;
                        await deleteUser({ variables: { userId: u.id } });
                        await refetch();
                      }}
                    >
                      <Trash2 size={13} />
                      {t.users.delete}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="p-6 text-center text-muted-foreground">
                    {t.users.empty}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function Books() {
  const t = useT();
  const [search, setSearch] = useState("");
  const { data, loading, refetch } = useQuery<AdminBooksQuery, AdminBooksQueryVariables>(
    ADMIN_BOOKS,
    { variables: { search: search || null, limit: 50 } },
  );
  const [deleteBook] = useMutation(ADMIN_DELETE_BOOK);
  const [mergeBooks] = useMutation(MERGE_BOOKS);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [targetSearch, setTargetSearch] = useState("");
  const [findTargets, { data: targetData }] = useLazyQuery<
    AdminBooksQuery,
    AdminBooksQueryVariables
  >(ADMIN_BOOKS);
  const books = data?.books ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t.books.title}</h2>
          <p className="text-sm text-muted-foreground">{t.books.subtitle}</p>
        </div>
        <Badge variant="secondary">{t.books.count(books.length)}</Badge>
      </div>
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder={t.books.search}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="pl-8"
        />
      </div>
      {loading && <p className="text-muted-foreground">{t.common.loading}</p>}
      {books.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {t.books.empty}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {books.map((b) => (
            <li key={b.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <span className="min-w-0">
                    <strong>{b.title}</strong> <span className="text-muted-foreground">{t.common.by} {b.author}</span>
                  </span>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Star size={12} />
                    {b.averageRating.toFixed(1)} ({t.books.reviews(b.reviewsCount)})
                  </Badge>
                  <span className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMergingId(b.id);
                      setTargetSearch("");
                      void findTargets({ variables: { search: null, limit: 10 } });
                    }}
                  >
                    {t.books.merge}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-1.5"
                    onClick={async () => {
                      if (!window.confirm(t.books.confirmDelete(b.title))) return;
                      await deleteBook({ variables: { id: b.id } });
                      await refetch();
                    }}
                  >
                    <Trash2 size={13} />
                    {t.books.delete}
                  </Button>
                </CardContent>
              </Card>
              {mergingId === b.id && (
                <Card className="mt-2">
                  <CardContent className="grid gap-2 p-3">
                    <span className="text-sm font-medium">{t.books.mergeInto}</span>
                    <Input
                      placeholder={t.books.mergeTargetPh}
                      value={targetSearch}
                      onChange={(e) => {
                        setTargetSearch(e.currentTarget.value);
                        void findTargets({
                          variables: { search: e.currentTarget.value || null, limit: 10 },
                        });
                      }}
                    />
                    {(targetData?.books ?? [])
                      .filter((cand) => cand.id !== b.id)
                      .map((cand) => (
                        <div key={cand.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1">
                            {cand.title} by {cand.author}
                          </span>
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (!window.confirm(t.books.mergeConfirm(b.title, cand.title))) {
                                return;
                              }
                              await mergeBooks({
                                variables: { sourceId: b.id, targetId: cand.id },
                              });
                              setMergingId(null);
                              await refetch();
                            }}
                          >
                            {t.books.mergeInto}
                          </Button>
                        </div>
                      ))}
                    <div>
                      <Button size="sm" variant="ghost" onClick={() => setMergingId(null)}>
                        {t.books.mergeCancel}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Audit() {
  const t = useT();
  const { data, loading } = useQuery<AdminAuditQuery>(ADMIN_AUDIT, {
    variables: { limit: 50 },
  });
  const entries = data?.auditLog ?? [];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t.audit.title}</h2>
        <p className="text-sm text-muted-foreground">{t.audit.subtitle}</p>
      </div>
      {loading && <p className="text-muted-foreground">{t.common.loading}</p>}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.audit.when}</TableHead>
                <TableHead>{t.audit.actor}</TableHead>
                <TableHead>{t.audit.action}</TableHead>
                <TableHead>{t.audit.target}</TableHead>
                <TableHead>{t.audit.detail}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{e.actor?.email ?? t.audit.deletedUser}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{e.action}</Badge>
                  </TableCell>
                  <TableCell>
                    {e.targetType}:{e.targetId.slice(0, 8)}
                  </TableCell>
                  <TableCell>{e.detail ?? "—"}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="p-6 text-center text-muted-foreground">
                    {t.audit.empty}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const NAV_LINKS: { to: string; labelKey: keyof Dict["nav"]; Icon: typeof LayoutDashboard }[] = [
  { to: "/dashboard", labelKey: "dashboard", Icon: LayoutDashboard },
  { to: "/users", labelKey: "users", Icon: UsersIcon },
  { to: "/books", labelKey: "books", Icon: BookOpen },
  { to: "/audit", labelKey: "audit", Icon: ScrollText },
] as const;

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
  const t = useT();
  const [authed, setAuthed] = useState(() => localStorage.getItem(ACCESS_KEY) != null);
  const { data } = useQuery<AdminMeQuery>(ADMIN_ME, { skip: !authed });

  const logout = () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setAuthed(false);
  };

  if (!authed) {
    return (
      <div className="mx-auto max-w-[980px] px-5 pb-16">
        <div className="mx-auto mt-12 max-w-[520px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheck size={18} />
                </span>
                {t.brand}
              </CardTitle>
              <CardDescription>{t.tagline}</CardDescription>
              <p className="text-sm text-muted-foreground">
                {t.signInBlurb}
              </p>
            </CardHeader>
            <CardContent>
              <Login onDone={() => setAuthed(true)} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (data?.me && data.me.role !== "admin") {
    return (
      <div className="mx-auto max-w-[980px] px-5 pb-16">
        <Card className="mt-12">
          <CardContent className="space-y-3 p-6">
            <p>{t.notAdmin}</p>
            <Button variant="outline" onClick={logout} className="flex items-center gap-1.5">
              <LogOut size={13} />
              {t.logout}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[980px] px-5 pb-16">
      <header className="sticky top-0 z-20 -mx-5 border-b bg-background/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[980px] flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck size={18} />
            </span>
            <span>
              {t.brand}
              <small className="block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t.tagline}
              </small>
            </span>
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <LangSwitcher />
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="flex items-center gap-1.5"
            >
              <LogOut size={13} />
              {t.logout}
            </Button>
          </div>
        </div>
      </header>
      <nav className="my-4 flex w-fit gap-1 rounded-full border bg-card p-1.5 shadow-sm">
        {NAV_LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              )
            }
          >
            <l.Icon size={14} />
            {t.nav[l.labelKey]}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/books" element={<Books />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
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
