import { pgTable, text, serial, integer, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === TABLE DEFINITIONS ===

// Classification enum values
export const CLASSIFICATION = {
  BRAINLIFT: 'brainlift',
  PARTIAL: 'partial',
  NOT_BRAINLIFT: 'not_brainlift'
} as const;

export type Classification = typeof CLASSIFICATION[keyof typeof CLASSIFICATION];

export const brainlifts = pgTable("brainlifts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  author: text("author"),
  classification: text("classification").$type<Classification>().default('brainlift').notNull(),
  rejectionReason: text("rejection_reason"),
  rejectionSubtype: text("rejection_subtype"),
  rejectionRecommendation: text("rejection_recommendation"),
  flags: text("flags").array(),
  originalContent: text("original_content"),
  sourceType: text("source_type"),
  summary: jsonb("summary").$type<{
    totalFacts: number;
    meanScore: string;
    score5Count: number;
    contradictionCount: number;
  }>().notNull(),
});

export const facts = pgTable("facts", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id),
  originalId: text("original_id").notNull(), // The string ID from JSON like "6.1"
  category: text("category").notNull(),
  source: text("source"), // Citation or source reference
  fact: text("fact").notNull(),
  score: integer("score").notNull(),
  contradicts: text("contradicts"), // Cluster name or null
  note: text("note"), // Explanation for the score
});

export const contradictionClusters = pgTable("contradiction_clusters", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id),
  name: text("name").notNull(),
  tension: text("tension").notNull(),
  status: text("status").notNull(),
  factIds: text("fact_ids").array().notNull(),
  claims: text("claims").array().notNull(),
});

export const readingListItems = pgTable("reading_list_items", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id),
  type: text("type").notNull(), // Twitter, Substack, etc.
  author: text("author").notNull(),
  topic: text("topic").notNull(),
  time: text("time").notNull(),
  facts: text("facts").notNull(), // "What it covers"
  url: text("url").notNull(),
});

export const readingListGrades = pgTable("reading_list_grades", {
  id: serial("id").primaryKey(),
  readingListItemId: integer("reading_list_item_id").notNull().references(() => readingListItems.id),
  aligns: text("aligns"), // "yes", "no", "partial"
  contradicts: text("contradicts"), // "yes", "no"
  newInfo: text("new_info"), // "yes", "no"
  quality: integer("quality"), // 1-5
});

export const sourceFeedback = pgTable("source_feedback", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id),
  sourceId: text("source_id").notNull(), // Unique ID: tweet ID or URL hash for research
  sourceType: text("source_type").notNull(), // "tweet" or "research"
  title: text("title").notNull(), // Author username for tweets, title for research
  snippet: text("snippet").notNull(), // Tweet text or research snippet
  url: text("url").notNull(),
  decision: text("decision").notNull(), // "accepted" or "rejected"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const brainliftVersions = pgTable("brainlift_versions", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id),
  versionNumber: integer("version_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sourceType: text("source_type").notNull(), // "pdf", "docx", "text", "workflowy", "gdocs"
  snapshot: jsonb("snapshot").$type<{
    title: string;
    description: string;
    author: string | null;
    summary: { totalFacts: number; meanScore: string; score5Count: number; contradictionCount: number };
    facts: Array<{ originalId: string; category: string; source: string | null; fact: string; score: number; contradicts: string | null; note: string | null }>;
    contradictionClusters: Array<{ name: string; tension: string; status: string; factIds: string[]; claims: string[] }>;
    readingList: Array<{ type: string; author: string; topic: string; time: string; facts: string; url: string }>;
    grades: Array<{ readingListTopic: string; aligns: string | null; contradicts: string | null; newInfo: string | null; quality: number | null }>;
  }>().notNull(),
});

export const experts = pgTable("experts", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id),
  name: text("name").notNull(),
  rankScore: integer("rank_score").notNull(), // 1-10 impact score
  rationale: text("rationale").notNull(), // One-line explanation for ranking
  source: text("source").notNull(), // "listed" (from brainlift) or "verification" (from fact notes)
  twitterHandle: text("twitter_handle"), // Optional X/Twitter handle
  isFollowing: boolean("is_following").notNull().default(true), // Auto-follow if rank > 5
});

// === RELATIONS ===

export const brainliftsRelations = relations(brainlifts, ({ many }) => ({
  facts: many(facts),
  contradictionClusters: many(contradictionClusters),
  readingListItems: many(readingListItems),
  versions: many(brainliftVersions),
  sourceFeedback: many(sourceFeedback),
  experts: many(experts),
}));

export const expertsRelations = relations(experts, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [experts.brainliftId],
    references: [brainlifts.id],
  }),
}));

export const sourceFeedbackRelations = relations(sourceFeedback, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [sourceFeedback.brainliftId],
    references: [brainlifts.id],
  }),
}));

export const brainliftVersionsRelations = relations(brainliftVersions, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [brainliftVersions.brainliftId],
    references: [brainlifts.id],
  }),
}));

export const factsRelations = relations(facts, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [facts.brainliftId],
    references: [brainlifts.id],
  }),
}));

export const contradictionClustersRelations = relations(contradictionClusters, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [contradictionClusters.brainliftId],
    references: [brainlifts.id],
  }),
}));

export const readingListItemsRelations = relations(readingListItems, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [readingListItems.brainliftId],
    references: [brainlifts.id],
  }),
  grade: one(readingListGrades),
}));

export const readingListGradesRelations = relations(readingListGrades, ({ one }) => ({
  readingListItem: one(readingListItems, {
    fields: [readingListGrades.readingListItemId],
    references: [readingListItems.id],
  }),
}));

// === SCHEMAS ===

export const insertBrainliftSchema = createInsertSchema(brainlifts);
export const insertFactSchema = createInsertSchema(facts).omit({ id: true });
export const insertContradictionClusterSchema = createInsertSchema(contradictionClusters).omit({ id: true });
export const insertReadingListItemSchema = createInsertSchema(readingListItems).omit({ id: true });
export const insertReadingListGradeSchema = createInsertSchema(readingListGrades).omit({ id: true });
export const insertSourceFeedbackSchema = createInsertSchema(sourceFeedback).omit({ id: true, createdAt: true });
export const insertBrainliftVersionSchema = createInsertSchema(brainliftVersions).omit({ id: true, createdAt: true });
export const insertExpertSchema = createInsertSchema(experts).omit({ id: true });

// === TYPES ===

export type Brainlift = typeof brainlifts.$inferSelect;
export type InsertBrainlift = z.infer<typeof insertBrainliftSchema>;

export type Fact = typeof facts.$inferSelect;
export type ContradictionCluster = typeof contradictionClusters.$inferSelect;
export type ReadingListItem = typeof readingListItems.$inferSelect;
export type ReadingListGrade = typeof readingListGrades.$inferSelect;
export type InsertReadingListGrade = z.infer<typeof insertReadingListGradeSchema>;
export type SourceFeedback = typeof sourceFeedback.$inferSelect;
export type InsertSourceFeedback = z.infer<typeof insertSourceFeedbackSchema>;
export type BrainliftVersion = typeof brainliftVersions.$inferSelect;
export type InsertBrainliftVersion = z.infer<typeof insertBrainliftVersionSchema>;
export type Expert = typeof experts.$inferSelect;
export type InsertExpert = z.infer<typeof insertExpertSchema>;

// Full brainlift data with nested relations (for API response)
export interface BrainliftData extends Brainlift {
  facts: Fact[];
  contradictionClusters: ContradictionCluster[];
  readingList: ReadingListItem[];
  experts: Expert[];
}
