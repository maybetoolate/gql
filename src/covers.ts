export function coversDir(): string {
  return process.env.COVERS_DIR ?? "./uploads/covers";
}
export const MAX_COVER_BYTES = 2 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isSafeBookId(id: string): boolean {
  return /^[A-Za-z0-9-]+$/.test(id);
}

async function unlinkIfExists(path: string): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(path);
  } catch {
    // Best-effort cleanup.
  }
}

export async function saveCover(bookId: string, file: File): Promise<string> {
  if (!isSafeBookId(bookId)) throw new Error("Invalid book id");
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    throw new Error("Cover must be a JPEG, PNG, WebP, or GIF image");
  }
  if (file.size <= 0) throw new Error("Empty file");
  if (file.size > MAX_COVER_BYTES) {
    throw new Error("Cover must be 2MB or smaller");
  }
  await Bun.write(`${coversDir()}/${bookId}.${ext}`, file);
  // Remove stale variants with a different extension.
  for (const other of new Set(Object.values(EXT_BY_TYPE))) {
    if (other !== ext) await unlinkIfExists(`${coversDir()}/${bookId}.${other}`);
  }
  return `/covers/${bookId}.${ext}`;
}

export async function deleteCoverForBook(bookId: string): Promise<void> {
  if (!isSafeBookId(bookId)) return;
  try {
    const glob = new Bun.Glob(`${bookId}.*`);
    for await (const name of glob.scan({ cwd: coversDir(), absolute: true })) {
      await unlinkIfExists(name);
    }
  } catch {
    // Missing directory or unreadable — nothing to clean.
  }
}
