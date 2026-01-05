import { db } from "./db";
import { brainlifts, facts, contradictionClusters, readingListItems, experts } from "@shared/schema";
import { sql } from "drizzle-orm";
import { brainliftsData, factsData, readingListData, contradictionsData, expertsData } from "./seedData";

export async function seedProductionIfEmpty() {
  try {
    const existingBrainlifts = await db.select({ id: brainlifts.id }).from(brainlifts).limit(1);
    
    if (existingBrainlifts.length > 0) {
      console.log("Database already has data, skipping seed");
      return;
    }

    console.log("Production database is empty, seeding with development data...");

    console.log(`Seeding ${brainliftsData?.length || 0} brainlifts...`);
    if (brainliftsData && brainliftsData.length > 0) {
      for (const bl of brainliftsData) {
        await db.insert(brainlifts).values({
          id: bl.id,
          slug: bl.slug,
          title: bl.title,
          description: bl.description,
          summary: bl.summary,
          author: bl.author,
          classification: bl.classification as any,
          rejectionReason: bl.rejection_reason,
          rejectionSubtype: bl.rejection_subtype,
          rejectionRecommendation: bl.rejection_recommendation,
          flags: bl.flags,
        }).onConflictDoNothing();
      }
    }

    console.log(`Seeding ${factsData?.length || 0} facts...`);
    if (factsData && factsData.length > 0) {
      for (const f of factsData) {
        await db.insert(facts).values({
          id: f.id,
          brainliftId: f.brainlift_id,
          originalId: f.original_id,
          category: f.category,
          fact: f.fact,
          score: f.score,
          contradicts: f.contradicts,
          source: f.source,
          note: f.note,
        }).onConflictDoNothing();
      }
    }

    console.log(`Seeding ${readingListData?.length || 0} reading list items...`);
    if (readingListData && readingListData.length > 0) {
      for (const r of readingListData) {
        await db.insert(readingListItems).values({
          id: r.id,
          brainliftId: r.brainlift_id,
          type: r.type,
          author: r.author,
          topic: r.topic,
          time: r.time,
          facts: r.facts,
          url: r.url,
        }).onConflictDoNothing();
      }
    }

    console.log(`Seeding ${contradictionsData?.length || 0} contradiction clusters...`);
    if (contradictionsData && contradictionsData.length > 0) {
      for (const c of contradictionsData) {
        await db.insert(contradictionClusters).values({
          id: c.id,
          brainliftId: c.brainlift_id,
          name: c.name,
          tension: c.tension,
          status: c.status as any,
          factIds: c.fact_ids,
          claims: c.claims,
        }).onConflictDoNothing();
      }
    }

    console.log(`Seeding ${expertsData?.length || 0} experts...`);
    if (expertsData && expertsData.length > 0) {
      for (const e of expertsData) {
        await db.insert(experts).values({
          id: e.id,
          brainliftId: e.brainlift_id,
          name: e.name,
          rankScore: e.rank_score,
          rationale: e.rationale,
          source: e.source,
          twitterHandle: e.twitter_handle,
          isFollowing: e.is_following,
        }).onConflictDoNothing();
      }
    }

    await db.execute(sql`SELECT setval('brainlifts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM brainlifts))`);
    await db.execute(sql`SELECT setval('facts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM facts))`);
    await db.execute(sql`SELECT setval('reading_list_items_id_seq', (SELECT COALESCE(MAX(id), 1) FROM reading_list_items))`);
    await db.execute(sql`SELECT setval('contradiction_clusters_id_seq', (SELECT COALESCE(MAX(id), 1) FROM contradiction_clusters))`);
    await db.execute(sql`SELECT setval('experts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM experts))`);

    console.log("Production database seeded successfully!");
  } catch (error) {
    console.error("Error seeding production database:", error);
  }
}
