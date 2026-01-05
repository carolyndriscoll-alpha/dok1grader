import { db } from "./db";
import { 
  brainlifts, facts, contradictionClusters, readingListItems, readingListGrades, brainliftVersions, sourceFeedback, experts,
  type Brainlift, type BrainliftData, type InsertBrainlift,
  type Fact, type ContradictionCluster, type ReadingListItem, type ReadingListGrade, type InsertReadingListGrade,
  type BrainliftVersion, type SourceFeedback, type InsertSourceFeedback, type Expert, type InsertExpert
} from "@shared/schema";
import { eq, inArray, desc, and } from "drizzle-orm";

export interface IStorage {
  getAllBrainlifts(): Promise<Brainlift[]>;
  getBrainliftBySlug(slug: string): Promise<BrainliftData | undefined>;
  createBrainlift(
    data: InsertBrainlift,
    factsData: any[],
    clustersData: any[],
    readingData: any[]
  ): Promise<BrainliftData>;
  updateBrainlift(
    slug: string,
    data: InsertBrainlift,
    factsData: any[],
    clustersData: any[],
    readingData: any[]
  ): Promise<BrainliftData>;
  deleteBrainlift(id: number): Promise<void>;
  getGradesByBrainliftId(brainliftId: number): Promise<ReadingListGrade[]>;
  saveGrade(data: InsertReadingListGrade): Promise<ReadingListGrade>;
  getVersionsByBrainliftId(brainliftId: number): Promise<BrainliftVersion[]>;
  addReadingListItem(brainliftId: number, item: {
    type: string;
    author: string;
    topic: string;
    time: string;
    facts: string;
    url: string;
  }): Promise<ReadingListItem>;
  
  getSourceFeedback(brainliftId: number, sourceType?: string): Promise<SourceFeedback[]>;
  saveSourceFeedback(data: InsertSourceFeedback): Promise<SourceFeedback>;
  getGradedReadingList(brainliftId: number): Promise<Array<ReadingListItem & { quality: number | null; aligns: string | null }>>;
  
  getExpertsByBrainliftId(brainliftId: number): Promise<Expert[]>;
  saveExperts(brainliftId: number, expertsData: InsertExpert[]): Promise<Expert[]>;
  updateExpertFollowing(expertId: number, isFollowing: boolean): Promise<Expert>;
  getFollowedExperts(brainliftId: number): Promise<Expert[]>;
  deleteExpert(expertId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAllBrainlifts(): Promise<Brainlift[]> {
    return await db.select().from(brainlifts);
  }

  async getBrainliftBySlug(slug: string): Promise<BrainliftData | undefined> {
    const [brainlift] = await db.select().from(brainlifts).where(eq(brainlifts.slug, slug));
    
    if (!brainlift) return undefined;

    const brainliftFacts = await db.select().from(facts).where(eq(facts.brainliftId, brainlift.id));
    const clusters = await db.select().from(contradictionClusters).where(eq(contradictionClusters.brainliftId, brainlift.id));
    const readingList = await db.select().from(readingListItems).where(eq(readingListItems.brainliftId, brainlift.id));
    const brainliftExperts = await db.select().from(experts).where(eq(experts.brainliftId, brainlift.id));

    return {
      ...brainlift,
      facts: brainliftFacts,
      contradictionClusters: clusters,
      readingList: readingList,
      experts: brainliftExperts.sort((a, b) => b.rankScore - a.rankScore)
    };
  }

  async createBrainlift(
    brainliftData: InsertBrainlift,
    factsData: any[],
    clustersData: any[],
    readingData: any[]
  ): Promise<BrainliftData> {
    // Transaction-like insertion
    const [brainlift] = await db.insert(brainlifts).values(brainliftData).returning();

    if (factsData.length > 0) {
      await db.insert(facts).values(factsData.map(f => ({ ...f, brainliftId: brainlift.id })));
    }

    if (clustersData.length > 0) {
      await db.insert(contradictionClusters).values(clustersData.map(c => ({ ...c, brainliftId: brainlift.id })));
    }

    if (readingData.length > 0) {
      await db.insert(readingListItems).values(readingData.map(r => ({ ...r, brainliftId: brainlift.id })));
    }

    return this.getBrainliftBySlug(brainlift.slug) as Promise<BrainliftData>;
  }

  async deleteBrainlift(id: number): Promise<void> {
    // Get reading list items to delete their grades first
    const items = await db.select().from(readingListItems).where(eq(readingListItems.brainliftId, id));
    const itemIds = items.map(i => i.id);
    
    if (itemIds.length > 0) {
      await db.delete(readingListGrades).where(inArray(readingListGrades.readingListItemId, itemIds));
    }
    
    // Delete related data
    await db.delete(readingListItems).where(eq(readingListItems.brainliftId, id));
    await db.delete(contradictionClusters).where(eq(contradictionClusters.brainliftId, id));
    await db.delete(facts).where(eq(facts.brainliftId, id));
    await db.delete(brainlifts).where(eq(brainlifts.id, id));
  }

  async getGradesByBrainliftId(brainliftId: number): Promise<ReadingListGrade[]> {
    const items = await db.select().from(readingListItems).where(eq(readingListItems.brainliftId, brainliftId));
    const itemIds = items.map(i => i.id);
    if (itemIds.length === 0) return [];
    
    return await db.select().from(readingListGrades).where(inArray(readingListGrades.readingListItemId, itemIds));
  }

  async saveGrade(data: InsertReadingListGrade): Promise<ReadingListGrade> {
    const [existing] = await db.select().from(readingListGrades).where(eq(readingListGrades.readingListItemId, data.readingListItemId));
    
    if (existing) {
      const [updated] = await db.update(readingListGrades)
        .set({ aligns: data.aligns, contradicts: data.contradicts, newInfo: data.newInfo, quality: data.quality })
        .where(eq(readingListGrades.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(readingListGrades).values(data).returning();
      return created;
    }
  }

  async updateBrainlift(
    slug: string,
    brainliftData: InsertBrainlift,
    factsData: any[],
    clustersData: any[],
    readingData: any[]
  ): Promise<BrainliftData> {
    const existing = await this.getBrainliftBySlug(slug);
    if (!existing) {
      throw new Error(`Brainlift with slug "${slug}" not found`);
    }

    const grades = await this.getGradesByBrainliftId(existing.id);
    
    const versions = await db.select().from(brainliftVersions)
      .where(eq(brainliftVersions.brainliftId, existing.id))
      .orderBy(desc(brainliftVersions.versionNumber));
    const nextVersionNumber = versions.length > 0 ? versions[0].versionNumber + 1 : 1;

    const gradesWithTopics = existing.readingList.map(item => {
      const grade = grades.find(g => g.readingListItemId === item.id);
      return {
        readingListTopic: item.topic,
        aligns: grade?.aligns || null,
        contradicts: grade?.contradicts || null,
        newInfo: grade?.newInfo || null,
        quality: grade?.quality || null,
      };
    });

    const snapshot = {
      title: existing.title,
      description: existing.description,
      author: existing.author,
      summary: existing.summary,
      facts: existing.facts.map(f => ({
        originalId: f.originalId,
        category: f.category,
        source: f.source,
        fact: f.fact,
        score: f.score,
        contradicts: f.contradicts,
        note: f.note,
      })),
      contradictionClusters: existing.contradictionClusters.map(c => ({
        name: c.name,
        tension: c.tension,
        status: c.status,
        factIds: c.factIds as string[],
        claims: c.claims as string[],
      })),
      readingList: existing.readingList.map(r => ({
        type: r.type,
        author: r.author,
        topic: r.topic,
        time: r.time,
        facts: r.facts,
        url: r.url,
      })),
      grades: gradesWithTopics,
    };

    await db.insert(brainliftVersions).values({
      brainliftId: existing.id,
      versionNumber: nextVersionNumber,
      sourceType: brainliftData.sourceType || 'unknown',
      snapshot,
    });

    const items = await db.select().from(readingListItems).where(eq(readingListItems.brainliftId, existing.id));
    const itemIds = items.map(i => i.id);
    if (itemIds.length > 0) {
      await db.delete(readingListGrades).where(inArray(readingListGrades.readingListItemId, itemIds));
    }
    await db.delete(readingListItems).where(eq(readingListItems.brainliftId, existing.id));
    await db.delete(contradictionClusters).where(eq(contradictionClusters.brainliftId, existing.id));
    await db.delete(facts).where(eq(facts.brainliftId, existing.id));

    await db.update(brainlifts)
      .set({
        title: brainliftData.title,
        description: brainliftData.description,
        author: brainliftData.author,
        summary: brainliftData.summary,
        classification: brainliftData.classification as any,
        rejectionReason: brainliftData.rejectionReason,
        rejectionSubtype: brainliftData.rejectionSubtype,
        rejectionRecommendation: brainliftData.rejectionRecommendation,
        originalContent: brainliftData.originalContent,
        sourceType: brainliftData.sourceType,
      })
      .where(eq(brainlifts.id, existing.id));

    console.log(`Inserting ${factsData.length} facts, ${clustersData.length} clusters, ${readingData.length} reading items`);
    
    if (factsData.length > 0) {
      try {
        const factsToInsert = factsData.map(f => ({ ...f, brainliftId: existing.id }));
        console.log('First fact to insert:', JSON.stringify(factsToInsert[0]));
        await db.insert(facts).values(factsToInsert);
        console.log('Facts inserted successfully');
      } catch (err) {
        console.error('Error inserting facts:', err);
        throw err;
      }
    }
    if (clustersData.length > 0) {
      try {
        await db.insert(contradictionClusters).values(clustersData.map(c => ({ ...c, brainliftId: existing.id })));
        console.log('Clusters inserted successfully');
      } catch (err) {
        console.error('Error inserting clusters:', err);
        throw err;
      }
    }
    if (readingData.length > 0) {
      try {
        await db.insert(readingListItems).values(readingData.map(r => ({ ...r, brainliftId: existing.id })));
        console.log('Reading items inserted successfully');
      } catch (err) {
        console.error('Error inserting reading items:', err);
        throw err;
      }
    }

    return this.getBrainliftBySlug(slug) as Promise<BrainliftData>;
  }

  async getVersionsByBrainliftId(brainliftId: number): Promise<BrainliftVersion[]> {
    return await db.select().from(brainliftVersions)
      .where(eq(brainliftVersions.brainliftId, brainliftId))
      .orderBy(desc(brainliftVersions.versionNumber));
  }

  async addReadingListItem(brainliftId: number, item: {
    type: string;
    author: string;
    topic: string;
    time: string;
    facts: string;
    url: string;
  }): Promise<ReadingListItem> {
    const [newItem] = await db.insert(readingListItems).values({
      brainliftId,
      type: item.type,
      author: item.author,
      topic: item.topic,
      time: item.time,
      facts: item.facts,
      url: item.url,
    }).returning();
    return newItem;
  }

  async getSourceFeedback(brainliftId: number, sourceType?: string): Promise<SourceFeedback[]> {
    if (sourceType) {
      return await db.select().from(sourceFeedback)
        .where(and(
          eq(sourceFeedback.brainliftId, brainliftId),
          eq(sourceFeedback.sourceType, sourceType)
        ));
    }
    return await db.select().from(sourceFeedback)
      .where(eq(sourceFeedback.brainliftId, brainliftId));
  }

  async saveSourceFeedback(data: InsertSourceFeedback): Promise<SourceFeedback> {
    const [existing] = await db.select().from(sourceFeedback)
      .where(and(
        eq(sourceFeedback.brainliftId, data.brainliftId),
        eq(sourceFeedback.sourceId, data.sourceId)
      ));
    
    if (existing) {
      const [updated] = await db.update(sourceFeedback)
        .set({ decision: data.decision })
        .where(eq(sourceFeedback.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(sourceFeedback).values(data).returning();
      return created;
    }
  }

  async getGradedReadingList(brainliftId: number): Promise<Array<ReadingListItem & { quality: number | null; aligns: string | null }>> {
    const items = await db.select().from(readingListItems).where(eq(readingListItems.brainliftId, brainliftId));
    const grades = await this.getGradesByBrainliftId(brainliftId);
    
    return items.map(item => {
      const grade = grades.find(g => g.readingListItemId === item.id);
      return {
        ...item,
        quality: grade?.quality || null,
        aligns: grade?.aligns || null,
      };
    });
  }

  async getExpertsByBrainliftId(brainliftId: number): Promise<Expert[]> {
    return await db.select().from(experts)
      .where(eq(experts.brainliftId, brainliftId))
      .orderBy(desc(experts.rankScore));
  }

  async saveExperts(brainliftId: number, expertsData: InsertExpert[]): Promise<Expert[]> {
    await db.delete(experts).where(eq(experts.brainliftId, brainliftId));
    
    if (expertsData.length === 0) return [];
    
    const inserted = await db.insert(experts).values(expertsData).returning();
    return inserted.sort((a, b) => b.rankScore - a.rankScore);
  }

  async updateExpertFollowing(expertId: number, isFollowing: boolean): Promise<Expert> {
    const [updated] = await db.update(experts)
      .set({ isFollowing })
      .where(eq(experts.id, expertId))
      .returning();
    return updated;
  }

  async getFollowedExperts(brainliftId: number): Promise<Expert[]> {
    return await db.select().from(experts)
      .where(and(
        eq(experts.brainliftId, brainliftId),
        eq(experts.isFollowing, true)
      ))
      .orderBy(desc(experts.rankScore));
  }

  async deleteExpert(expertId: number): Promise<void> {
    await db.delete(experts).where(eq(experts.id, expertId));
  }
}

export const storage = new DatabaseStorage();
