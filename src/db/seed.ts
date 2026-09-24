import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { users, books, reviews, reviewComments, reviewLikes, notifications, favorites, follows, shelfItems } from "./schema";
import { hashPassword } from "../auth";
import { linkTagToBook } from "../schema";

interface SampleBook {
  title: string;
  author: string;
  year: number;
  description: string;
  tags: string[];
}

const SAMPLE_BOOKS: SampleBook[] = [
  {
    title: "The Awakening",
    author: "Kate Chopin",
    year: 1899,
    description: "A pioneering work of feminist literature about self-discovery.",
    tags: ["classic", "feminist"],
  },
  {
    title: "City of Glass",
    author: "Paul Auster",
    year: 1985,
    description: "A postmodern detective story, first in The New York Trilogy.",
    tags: ["mystery", "postmodern"],
  },
  {
    title: "Dune",
    author: "Frank Herbert",
    year: 1965,
    description: "Epic science fiction saga of politics and prophecy on Arrakis.",
    tags: ["sci-fi", "classic"],
  },
  {
    title: "Pride and Prejudice",
    author: "Jane Austen",
    year: 1813,
    description: "A classic romance of manners in Regency England.",
    tags: ["romance", "classic"],
  },
  {
    title: "1984",
    author: "George Orwell",
    year: 1949,
    description: "Dystopian vision of totalitarian surveillance.",
    tags: ["dystopia", "classic"],
  },
  {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    year: 1937,
    description: "Bilbo Baggins joins dwarves on a quest to the Lonely Mountain.",
    tags: ["fantasy", "classic"],
  },
];

export async function seedIfEmpty() {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(books);
  if (Number(existing[0]?.count ?? 0) > 0) return;

  console.log("Seeding database…");

  const passwordHash = await hashPassword("password123");
  const [demo] = await db
    .insert(users)
    .values({ email: "demo@example.com", name: "Demo Reader", passwordHash, role: "admin" })
    .returning();

  const inserted = await db
    .insert(books)
    .values(SAMPLE_BOOKS.map(({ tags: _, ...b }) => b))
    .returning();

  for (const sample of SAMPLE_BOOKS) {
    const row = inserted.find((b) => b.title === sample.title);
    if (!row) continue;
    for (const tag of sample.tags) {
      await linkTagToBook(row.id, tag);
    }
  }

  const dune = inserted.find((b) => b.title === "Dune");
  const hobbit = inserted.find((b) => b.title === "The Hobbit");
  if (dune) {
    const [duneReview] = await db
      .insert(reviews)
      .values({
        userId: demo.id,
        bookId: dune.id,
        rating: 5,
        text: "A masterpiece. The worldbuilding is unmatched.",
      })
      .returning();
    await db.insert(reviewComments).values({
      userId: demo.id,
      reviewId: duneReview.id,
      text: "Still holds up on every re-read.",
    });
    await db
      .insert(shelfItems)
      .values({ userId: demo.id, bookId: dune.id, status: "finished" });
    await db.insert(favorites).values({ userId: demo.id, bookId: dune.id });
  }
  if (hobbit) {
    await db
      .insert(shelfItems)
      .values({ userId: demo.id, bookId: hobbit.id, status: "reading" });
    await db.insert(favorites).values({ userId: demo.id, bookId: hobbit.id });
  }

  // Second user so the activity feed is non-empty: Sam follows demo.
  const [sam] = await db
    .insert(users)
    .values({ email: "sam@example.com", name: "Sam Reader", passwordHash })
    .returning();
  await db.insert(follows).values({ followerId: sam.id, followeeId: demo.id });
  await db.insert(follows).values({ followerId: demo.id, followeeId: sam.id });
  const orwell = inserted.find((b) => b.title === "1984");
  if (orwell) {
    await db.insert(reviews).values({
      userId: sam.id,
      bookId: orwell.id,
      rating: 4,
      text: "Chilling and more relevant every year.",
    });
    if (hobbit) {
      await db
        .insert(shelfItems)
        .values({ userId: sam.id, bookId: hobbit.id, status: "reading", progress: 40 });
    }
  }
  if (dune) {
    // Sam likes demo's Dune review so the inbox isn't empty.
    // (Notifications are emitted by the like mutation in normal flow;
    // seeding inserts the like + notification rows directly.)
    const duneReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.bookId, dune.id));
    const target = duneReviews.find((r) => r.userId === demo.id);
    if (target) {
      await db.insert(reviewLikes).values({ userId: sam.id, reviewId: target.id });
      await db.insert(notifications).values({
        userId: demo.id,
        actorId: sam.id,
        type: "REVIEW_LIKE",
        reviewId: target.id,
        bookId: dune.id,
      });
    }
  }

  console.log(
    `Seeded ${inserted.length} books + demo users demo@example.com, sam@example.com / password123`,
  );
}

export async function getBookById(id: string) {
  const rows = await db.select().from(books).where(eq(books.id, id));
  return rows[0] ?? null;
}
