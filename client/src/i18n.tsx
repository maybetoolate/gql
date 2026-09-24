import { createContext, useCallback, useContext, useState } from "react";

export type Lang = "en" | "es";
const LANG_KEY = "gql-lang";

const en = {
  appTagline: "discover · track · share",
  sidebarTip: "Track progress, shelve favorites, and follow readers to fill your feed.",
  common: {
    loading: "Loading…",
    back: "Back",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    post: "Post",
    view: "View",
    remove: "Remove",
    failed: "Failed",
    errorPrefix: "Error: ",
    by: "by",
  },
  nav: {
    books: "Books",
    shelf: "My Shelf",
    favorites: "Favorites",
    feed: "Feed",
    foryou: "For You",
    import: "Import",
    settings: "Settings",
    challenges: "Challenges",
  },
  auth: {
    signedInAs: "Signed in as",
    logout: "Log out",
    logoutAll: "Log out everywhere",
    needAccount: "Need account? Register",
    haveAccount: "Have account? Log in",
    name: "Name",
    email: "Email",
    password: "Password",
    login: "Log in",
    register: "Register",
    or: "or",
    notAdmin: "This account is not an admin.",
  },
  shelfStatus: {
    label: "Shelf: —",
    want_to_read: "Want to read",
    reading: "Reading",
    finished: "Finished",
  },
  fav: {
    favorited: "Favorited",
    favorite: "Favorite",
    badge: "Favorite",
  },
  bookDetail: {
    notFound: "Not found. ",
    reviews: "Reviews",
    reviewsCount: (n: number) => `${n} reviews`,
    newest: "Newest",
    top: "Top",
    noReviews: "No reviews yet — be the first.",
    writeReview: "Write a review…",
    postReview: "Post review",
    loginPrompt: "Log in to review, shelve, or favorite.",
    deleteBook: "Delete book",
    cover: "Cover:",
    uploadFailed: (msg: string) => `Upload failed: ${msg}`,
    newTag: "new tag",
    removeTagTitle: (name: string) => `Remove #${name}`,
  },
  reviews: {
    by: "by",
    show: "Show",
    hide: "Hide",
    comments: (n: number) => `comments (${n})`,
    deleteReview: "Delete review",
    edit: "Edit",
    delete: "Delete",
    addComment: "Add a comment…",
    post: "Post",
  },
  follow: {
    follow: "Follow",
    unfollow: "Unfollow",
  },
  books: {
    title: "Discover books",
    subtitle: "Search the catalog, filter by tags, and add missing titles.",
    count: (n: number, filtered: boolean) =>
      `${n} book(s)${filtered ? " match your filters" : " total"}`,
    searchPlaceholder: "Search title, author, description…",
    sortNewest: "Newest",
    sortRating: "Top rated",
    sortTitle: "Title A–Z",
    sortAuthor: "Author A–Z",
    addTitle: "Add a book",
    addSubtitle: "Can't find a title? Add it to the catalog.",
    titlePh: "Title",
    authorPh: "Author",
    yearPh: "Year",
    descriptionPh: "Description",
    addBook: "Add book",
    noResults: "No books found — try a different search.",
    loadMore: "Load more",
    tagTitle: (n: number) => `${n} books`,
  },
  importView: {
    loginRequired: "Log in to import or export.",
    title: "Import & export",
    subtitle: "Move your library in and out with Goodreads CSV and JSON backups.",
    exportTitle: "Download everything you own as JSON.",
    exporting: "Exporting…",
    exportButton: "Download my data (JSON)",
    exportCsvButton: "Download Goodreads CSV",
    importTitle: "Import Goodreads CSV",
    importHelp: "Goodreads → My Books → Import books → Export. Upload the CSV here.",
    ready: (n: number) => `${n} books ready`,
    skipped: (n: number) => ` (${n} rows skipped)`,
    andMore: (n: number) => `…and ${n} more`,
    importing: "Importing…",
    importButton: (n: number) => `Import ${n} books`,
    result: (r: { imported: number; matched: number; shelved: number; reviewed: number }) =>
      `Imported ${r.imported}, matched ${r.matched}, shelved ${r.shelved}, reviewed ${r.reviewed}`,
    resultErrors: (e: string) => `. Errors: ${e}`,
    exportTab: "Export",
  },
  goals: {
    prompt: (year: number) => `${year} reading goal:`,
    setGoal: "Set goal",
    line: (year: number, done: number, target: number, pct: number) =>
      `${year} goal: ${done}/${target} (${pct}%)`,
    complete: "Complete!",
    remaining: (n: number) => `${n} to go`,
  },
  challenges: {
    title: "Challenges",
    subtitle: "Race readers to finish the most books.",
    loginRequired: "Log in to join challenges.",
    filterAll: "All",
    filterActive: "Active",
    filterUpcoming: "Upcoming",
    filterEnded: "Ended",
    members: (n: number) => `${n} members`,
    progress: (done: number, target: number) => `${done}/${target} books`,
    join: "Join",
    leave: "Leave",
    leaderboard: "Leaderboard",
    noEntries: "No entries yet.",
    createTitle: "Start a challenge",
    namePh: "Name (e.g. October Sprint)",
    descriptionPh: "Description (optional)",
    targetPh: "Target books",
    durationPh: "Duration (days)",
    startPh: "Start date",
    endPh: "End date",
    create: "Create challenge",
    empty: "No challenges here yet — start one!",
  },
  shelf: {
    loginRequired: "Log in to see your shelf.",
    title: "My shelf",
    subtitle: "Track reading progress and yearly goals.",
    empty: "Nothing here yet.",
    statsTitle: (year: number) => `Finished per month — ${year}`,
  },
  settings: {
    title: "Settings",
    subtitle: "Profile, password, and notification preferences.",
    loginRequired: "Log in to change settings.",
    profileTitle: "Profile",
    namePh: "Display name",
    saveName: "Save name",
    passwordTitle: "Password",
    currentPh: "Current password",
    newPh: "New password (min 6)",
    changePassword: "Change password",
    passwordChanged: "Password changed — other sessions logged out.",
    prefsTitle: "Notifications",
    prefFollow: "New followers",
    prefLike: "Likes on my reviews",
    prefComment: "Comments on my reviews",
  },
  notifications: {
    markAllRead: "Mark all read",
    title: "Notifications",
    empty: "No notifications.",
    follow: (name: string) => `${name} started following you`,
    like: (name: string, title?: string | null) =>
      `${name} liked your review${title ? ` of ${title}` : ""}`,
    comment: (name: string, title?: string | null) =>
      `${name} commented on your review${title ? ` of ${title}` : ""}`,
  },
  feed: {
    loginRequired: "Log in and follow readers to see their activity.",
    empty: "Nothing yet — follow readers from book reviews.",
    title: "Activity feed",
    subtitle: "Updates from readers you follow.",
    reviewed: (title: string, rating: string | null | undefined) => `reviewed ${title}${rating ? ` (${rating}★)` : ""}`,
    favorited: (title: string) => `favorited ${title}`,
    shelfUpdate: (title: string, status: string | null | undefined) => `updated shelf: ${status} — ${title}`,
    viewBook: "View book",
  },
  favorites: {
    loginRequired: "Log in to see favorites.",
    title: "Favorites",
    subtitle: "Books you marked with Favorite.",
    empty: "No favorites yet — tap Favorite on any book.",
  },
  foryou: {
    loginRequired: "Log in to get recommendations.",
    title: "For you",
    subtitle: "Recommendations based on your shelf and ratings.",
    empty: "No recommendations yet — rate and shelve some books.",
  },
};

export type Dict = typeof en;

const es: Dict = {
  appTagline: "descubre · sigue · comparte",
  sidebarTip: "Sigue tu progreso, guarda favoritos y sigue lectores para llenar tu feed.",
  common: {
    loading: "Cargando…",
    back: "Atrás",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    add: "Añadir",
    post: "Publicar",
    view: "Ver",
    remove: "Quitar",
    failed: "Falló",
    errorPrefix: "Error: ",
    by: "por",
  },
  nav: {
    books: "Libros",
    shelf: "Mi estante",
    favorites: "Favoritos",
    feed: "Feed",
    foryou: "Para ti",
    import: "Importar",
    settings: "Ajustes",
    challenges: "Retos",
  },
  auth: {
    signedInAs: "Sesión iniciada como",
    logout: "Cerrar sesión",
    logoutAll: "Cerrar sesión en todo",
    needAccount: "¿Sin cuenta? Regístrate",
    haveAccount: "¿Tienes cuenta? Inicia sesión",
    name: "Nombre",
    email: "Correo",
    password: "Contraseña",
    login: "Iniciar sesión",
    register: "Registrarse",
    or: "o",
    notAdmin: "Esta cuenta no es administradora.",
  },
  shelfStatus: {
    label: "Estante: —",
    want_to_read: "Quiero leer",
    reading: "Leyendo",
    finished: "Terminado",
  },
  fav: {
    favorited: "En favoritos",
    favorite: "Marcar favorito",
    badge: "Favorito",
  },
  bookDetail: {
    notFound: "No encontrado. ",
    reviews: "Reseñas",
    reviewsCount: (n: number) => `${n} reseñas`,
    newest: "Recientes",
    top: "Top",
    noReviews: "Aún no hay reseñas — sé el primero.",
    writeReview: "Escribe una reseña…",
    postReview: "Publicar reseña",
    loginPrompt: "Inicia sesión para reseñar, guardar o marcar favoritos.",
    deleteBook: "Eliminar libro",
    cover: "Portada:",
    uploadFailed: (msg: string) => `Falló la subida: ${msg}`,
    newTag: "nueva etiqueta",
    removeTagTitle: (name: string) => `Quitar #${name}`,
  },
  reviews: {
    by: "por",
    show: "Mostrar",
    hide: "Ocultar",
    comments: (n: number) => `comentarios (${n})`,
    deleteReview: "Eliminar reseña",
    edit: "Editar",
    delete: "Eliminar",
    addComment: "Añade un comentario…",
    post: "Publicar",
  },
  follow: {
    follow: "Seguir",
    unfollow: "Dejar de seguir",
  },
  books: {
    title: "Descubre libros",
    subtitle: "Busca en el catálogo, filtra por etiquetas y añade títulos.",
    count: (n: number, filtered: boolean) =>
      `${n} libro(s)${filtered ? " coinciden" : " en total"}`,
    searchPlaceholder: "Busca título, autor, descripción…",
    sortNewest: "Novedades",
    sortRating: "Mejor valorados",
    sortTitle: "Título A–Z",
    sortAuthor: "Autor A–Z",
    addTitle: "Añade un libro",
    addSubtitle: "¿No encuentras un título? Añádelo al catálogo.",
    titlePh: "Título",
    authorPh: "Autor",
    yearPh: "Año",
    descriptionPh: "Descripción",
    addBook: "Añadir libro",
    noResults: "Sin resultados — prueba otra búsqueda.",
    loadMore: "Cargar más",
    tagTitle: (n: number) => `${n} libros`,
  },
  importView: {
    loginRequired: "Inicia sesión para importar o exportar.",
    title: "Importar y exportar",
    subtitle: "Mueve tu biblioteca con CSV de Goodreads y copias JSON.",
    exportTitle: "Descarga todo lo tuyo en JSON.",
    exporting: "Exportando…",
    exportButton: "Descargar mis datos (JSON)",
    exportCsvButton: "Descargar CSV de Goodreads",
    importTitle: "Importar CSV de Goodreads",
    importHelp: "Goodreads → My Books → Import books → Export. Sube el CSV aquí.",
    ready: (n: number) => `${n} libros listos`,
    skipped: (n: number) => ` (${n} filas omitidas)`,
    andMore: (n: number) => `…y ${n} más`,
    importing: "Importando…",
    importButton: (n: number) => `Importar ${n} libros`,
    result: (r: { imported: number; matched: number; shelved: number; reviewed: number }) =>
      `Importados ${r.imported}, existentes ${r.matched}, guardados ${r.shelved}, reseñados ${r.reviewed}`,
    resultErrors: (e: string) => `. Errores: ${e}`,
    exportTab: "Exportar",
  },
  goals: {
    prompt: (year: number) => `Meta de lectura ${year}:`,
    setGoal: "Fijar meta",
    line: (year: number, done: number, target: number, pct: number) =>
      `Meta ${year}: ${done}/${target} (${pct}%)`,
    complete: "¡Completada!",
    remaining: (n: number) => `faltan ${n}`,
  },
  challenges: {
    title: "Retos",
    subtitle: "Compite con lectores por terminar más libros.",
    loginRequired: "Inicia sesión para unirte a retos.",
    filterAll: "Todos",
    filterActive: "Activos",
    filterUpcoming: "Próximos",
    filterEnded: "Terminados",
    members: (n: number) => `${n} miembros`,
    progress: (done: number, target: number) => `${done}/${target} libros`,
    join: "Unirse",
    leave: "Salir",
    leaderboard: "Clasificación",
    noEntries: "Sin participantes todavía.",
    createTitle: "Crea un reto",
    namePh: "Nombre (p. ej. Sprint de octubre)",
    descriptionPh: "Descripción (opcional)",
    targetPh: "Meta de libros",
    durationPh: "Duración (días)",
    startPh: "Fecha de inicio",
    endPh: "Fecha de fin",
    create: "Crear reto",
    empty: "No hay retos — ¡crea uno!",
  },
  shelf: {
    loginRequired: "Inicia sesión para ver tu estante.",
    title: "Mi estante",
    subtitle: "Sigue tu progreso y tus metas anuales.",
    empty: "Nada aquí todavía.",
    statsTitle: (year: number) => `Terminados por mes — ${year}`,
  },
  settings: {
    title: "Ajustes",
    subtitle: "Perfil, contraseña y notificaciones.",
    loginRequired: "Inicia sesión para cambiar ajustes.",
    profileTitle: "Perfil",
    namePh: "Nombre visible",
    saveName: "Guardar nombre",
    passwordTitle: "Contraseña",
    currentPh: "Contraseña actual",
    newPh: "Nueva contraseña (mín. 6)",
    changePassword: "Cambiar contraseña",
    passwordChanged: "Contraseña cambiada — otras sesiones cerradas.",
    prefsTitle: "Notificaciones",
    prefFollow: "Nuevos seguidores",
    prefLike: "Me gusta en mis reseñas",
    prefComment: "Comentarios en mis reseñas",
  },
  notifications: {
    markAllRead: "Marcar todo leído",
    title: "Notificaciones",
    empty: "Sin notificaciones.",
    follow: (name: string) => `${name} empezó a seguirte`,
    like: (name: string, title?: string | null) =>
      `A ${name} le gustó tu reseña${title ? ` de ${title}` : ""}`,
    comment: (name: string, title?: string | null) =>
      `${name} comentó tu reseña${title ? ` de ${title}` : ""}`,
  },
  feed: {
    loginRequired: "Inicia sesión y sigue lectores para ver su actividad.",
    empty: "Nada todavía — sigue lectores desde las reseñas.",
    title: "Feed de actividad",
    subtitle: "Novedades de lectores que sigues.",
    reviewed: (title: string, rating: string | null | undefined) => `reseñó ${title}${rating ? ` (${rating}★)` : ""}`,
    favorited: (title: string) => `marcó favorito ${title}`,
    shelfUpdate: (title: string, status: string | null | undefined) => `actualizó estante: ${status} — ${title}`,
    viewBook: "Ver libro",
  },
  favorites: {
    loginRequired: "Inicia sesión para ver favoritos.",
    title: "Favoritos",
    subtitle: "Libros que marcaste con Favorito.",
    empty: "Sin favoritos — toca Favorito en cualquier libro.",
  },
  foryou: {
    loginRequired: "Inicia sesión para ver recomendaciones.",
    title: "Para ti",
    subtitle: "Recomendaciones según tu estante y valoraciones.",
    empty: "Sin recomendaciones — valora y guarda libros.",
  },
};

const DICTS: Record<Lang, Dict> = { en, es };

/** Exported for structural tests (shape is already enforced by `es: Dict`). */
export const _dictsForTests = { en, es };

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

const SESSION_EXPIRED: Record<Lang, string> = {
  en: "Session expired. Please log in again.",
  es: "Sesión expirada. Inicia sesión de nuevo.",
};

/** Non-React lookup for code outside components (uses the stored preference). */
export function sessionExpiredMessage(): string {
  return SESSION_EXPIRED[localStorage.getItem(LANG_KEY) === "es" ? "es" : "en"];
}
