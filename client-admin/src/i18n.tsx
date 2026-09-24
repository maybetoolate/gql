import { createContext, useCallback, useContext, useState } from "react";

export type Lang = "en" | "es";
const LANG_KEY = "gql-admin-lang";

const en = {
  brand: "Bookshelf Admin",
  tagline: "moderation console",
  signInBlurb: "Sign in with an admin account to manage users and books.",
  notAdmin: "Not an admin account.",
  logout: "Log out",
  login: {
    email: "Email",
    password: "Password",
    submit: "Log in as admin",
    failed: "Login failed",
    notAdmin: "This account is not an admin.",
  },
  nav: {
    dashboard: "Dashboard",
    users: "Users",
    books: "Books",
    audit: "Audit",
  },
  dashboard: {
    title: "Overview",
    subtitle: "Library activity at a glance.",
    users: "Total users",
    books: "Total books",
    reviews: "Total reviews",
    comments: "Total comments",
    shelf: "Shelf items",
    favorites: "Favorites",
    follows: "Follows",
    tags: "Tags",
  },
  users: {
    title: "User management",
    subtitle: "Search accounts, change roles, or remove users.",
    count: (n: number) => `${n} user(s)`,
    search: "Search email or name…",
    email: "Email",
    name: "Name",
    role: "Role",
    followers: "Followers",
    following: "Following",
    delete: "Delete",
    confirmDelete: (email: string) => `Delete ${email} and all their content?`,
    empty: "No users match your search.",
  },
  books: {
    title: "Book catalog",
    subtitle: "Search titles and remove entries.",
    count: (n: number) => `${n} book(s)`,
    search: "Search books…",
    reviews: (n: number) => `${n} reviews`,
    delete: "Delete",
    confirmDelete: (title: string) => `Delete "${title}"?`,
    empty: "No books match your search.",
    merge: "Merge…",
    mergeInto: "Merge into…",
    mergeTargetPh: "Search target book…",
    mergeConfirm: (source: string, target: string) =>
      `Merge "${source}" into "${target}"? Reviews, shelf entries, favorites, and tags move over.`,
    mergeCancel: "Cancel",
  },
  audit: {
    title: "Audit log",
    subtitle: "Destructive actions and who performed them.",
    empty: "No audit entries yet.",
    actor: "Actor",
    action: "Action",
    target: "Target",
    detail: "Detail",
    when: "When",
    deletedUser: "(deleted user)",
  },
  common: {
    loading: "Loading…",
    errorPrefix: "Error: ",
    by: "by",
  },
};

export type Dict = typeof en;

const es: Dict = {
  brand: "Bookshelf Admin",
  tagline: "consola de moderación",
  signInBlurb: "Inicia sesión con una cuenta administradora para gestionar usuarios y libros.",
  notAdmin: "No es una cuenta administradora.",
  logout: "Cerrar sesión",
  login: {
    email: "Correo",
    password: "Contraseña",
    submit: "Iniciar sesión como admin",
    failed: "Falló el inicio de sesión",
    notAdmin: "Esta cuenta no es administradora.",
  },
  nav: {
    dashboard: "Panel",
    users: "Usuarios",
    books: "Libros",
    audit: "Auditoría",
  },
  dashboard: {
    title: "Resumen",
    subtitle: "Actividad de la biblioteca de un vistazo.",
    users: "Usuarios totales",
    books: "Libros totales",
    reviews: "Reseñas totales",
    comments: "Comentarios totales",
    shelf: "Elementos guardados",
    favorites: "Favoritos",
    follows: "Seguimientos",
    tags: "Etiquetas",
  },
  users: {
    title: "Gestión de usuarios",
    subtitle: "Busca cuentas, cambia roles o elimina usuarios.",
    count: (n: number) => `${n} usuario(s)`,
    search: "Busca correo o nombre…",
    email: "Correo",
    name: "Nombre",
    role: "Rol",
    followers: "Seguidores",
    following: "Seguidos",
    delete: "Eliminar",
    confirmDelete: (email: string) => `¿Eliminar ${email} y todo su contenido?`,
    empty: "Ningún usuario coincide con la búsqueda.",
  },
  books: {
    title: "Catálogo de libros",
    subtitle: "Busca títulos y elimina entradas.",
    count: (n: number) => `${n} libro(s)`,
    search: "Busca libros…",
    reviews: (n: number) => `${n} reseñas`,
    delete: "Eliminar",
    confirmDelete: (title: string) => `¿Eliminar "${title}"?`,
    empty: "Ningún libro coincide con la búsqueda.",
    merge: "Fusionar…",
    mergeInto: "Fusionar en…",
    mergeTargetPh: "Busca libro destino…",
    mergeConfirm: (source: string, target: string) =>
      `¿Fusionar "${source}" en "${target}"? Reseñas, estante, favoritos y etiquetas se mueven.`,
    mergeCancel: "Cancelar",
  },
  audit: {
    title: "Registro de auditoría",
    subtitle: "Acciones destructivas y quién las hizo.",
    empty: "Sin entradas todavía.",
    actor: "Actor",
    action: "Acción",
    target: "Objetivo",
    detail: "Detalle",
    when: "Cuándo",
    deletedUser: "(usuario eliminado)",
  },
  common: {
    loading: "Cargando…",
    errorPrefix: "Error: ",
    by: "por",
  },
};

const DICTS: Record<Lang, Dict> = { en, es };

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const LangContext = createContext<LangState>({
  lang: "en",
  setLang: () => {},
  t: en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    localStorage.getItem(LANG_KEY) === "es" ? "es" : "en",
  );
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  }, []);
  return (
    <LangContext.Provider value={{ lang, setLang, t: DICTS[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangState {
  return useContext(LangContext);
}

export function useT(): Dict {
  return useContext(LangContext).t;
}

export { LANG_KEY };

/** Exported for structural tests (shape is already enforced by `es: Dict`). */
export const _dictsForTests = { en, es };
