import { pgTable, text, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  clerkId: text("clerk_id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tracksTable = pgTable("tracks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.clerkId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  iconName: text("icon_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  deleted: boolean("deleted").notNull().default(false),
  measurementLabel: text("measurement_label"),
  measurementUnit: text("measurement_unit"),
});

export const photosTable = pgTable("photos", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.clerkId, { onDelete: "cascade" }),
  trackId: text("track_id").notNull(),
  objectPath: text("object_path").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  deleted: boolean("deleted").notNull().default(false),
  tiltX: doublePrecision("tilt_x"),
  tiltY: doublePrecision("tilt_y"),
  tiltZ: doublePrecision("tilt_z"),
  measurementValue: doublePrecision("measurement_value"),
});

// Server-trusted record of who owns each uploaded object. A row is inserted
// when the upload URL is issued, so ownership cannot be claimed retroactively
// by a malicious client through the sync push endpoint.
export const objectOwnersTable = pgTable("object_owners", {
  objectPath: text("object_path").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => usersTable.clerkId, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type DbUser = typeof usersTable.$inferSelect;
export type DbTrack = typeof tracksTable.$inferSelect;
export type DbPhoto = typeof photosTable.$inferSelect;
export type DbObjectOwner = typeof objectOwnersTable.$inferSelect;
