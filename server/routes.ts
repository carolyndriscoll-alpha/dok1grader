import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import fs from "fs";
import path from "path";
import multer from "multer";
import * as mammoth from "mammoth";
import { extractBrainlift, BrainliftOutput } from "./ai/brainliftExtractor";
import { searchForResources, deepResearch } from "./ai/resourceResearcher";
import { searchRelevantTweets } from "./ai/twitterService";
import { extractAndRankExperts } from "./ai/expertExtractor";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

async function seedDatabase() {
  console.log("Checking seed data...");
  
  const seedFiles = [
    { slug: 'alpha-schools', file: 'attached_assets/alpha-schools_1767269704970.json' },
    { slug: 'knowledge-rich-curriculum', file: 'attached_assets/knowledge-rich-curriculum_1767269704970.json' },
    { slug: 'zach-groshell-direct-instruction', file: 'attached_assets/zach-groshell-direct-instruction_1767355128825.json' },
    { slug: 'applying-how-vocabulary-is-learned', file: 'attached_assets/applying-how-vocabulary-is-learned_1767356606087.json' },
    { slug: 'alphawrite-writing-revolution', file: 'attached_assets/alphawrite-writing-revolution_1767389329041.json' }
  ];

  for (const item of seedFiles) {
    try {
      if (fs.existsSync(item.file)) {
        const content = fs.readFileSync(item.file, 'utf-8');
        const data = JSON.parse(content);
        
        // Check if brainlift exists and needs update
        const existing = await storage.getBrainliftBySlug(item.slug);
        if (existing) {
          // Check if data matches - compare first fact's source AND score
          const expectedSource = data.facts[0]?.source;
          const expectedScore = data.facts[0]?.score;
          const currentSource = existing.facts[0]?.source;
          const currentScore = existing.facts[0]?.score;
          
          // Also check a few more facts to catch score changes
          const scoresMatch = data.facts.every((f: any, i: number) => {
            const existingFact = existing.facts.find((ef: any) => ef.originalId === f.id);
            return existingFact && existingFact.score === f.score;
          });
          
          if (expectedSource === currentSource && scoresMatch) {
            console.log(`${item.slug} already up-to-date, skipping`);
            continue;
          }
          // Delete stale data (scores or source changed)
          console.log(`Updating stale data for ${item.slug} (scores or source changed)...`);
          await storage.deleteBrainlift(existing.id);
        }
        
        await storage.createBrainlift(
          {
            slug: item.slug,
            title: data.title,
            description: data.description,
            summary: data.summary,
            author: data.author || null,
            classification: data.classification || 'brainlift',
            rejectionReason: data.rejectionReason || null,
            rejectionSubtype: data.rejectionSubtype || null,
            rejectionRecommendation: data.rejectionRecommendation || null,
            flags: data.flags || null,
          },
          (data.facts || []).map((f: any) => ({
            originalId: f.id,
            category: f.category,
            source: f.source || null,
            fact: f.fact,
            score: f.score,
            contradicts: f.contradicts,
            note: f.note || null,
          })),
          (data.contradictionClusters || []).map((c: any) => ({
            name: c.name,
            tension: c.tension,
            status: c.status,
            factIds: c.factIds,
            claims: c.claims
          })),
          (data.readingList || []).map((r: any) => ({
            type: r.type,
            author: r.author,
            topic: r.topic,
            time: r.time,
            facts: r.facts,
            url: r.url
          }))
        );
        console.log(`Seeded ${item.slug}`);
      }
    } catch (e) {
      console.error(`Failed to seed ${item.slug}:`, e);
    }
  }
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = (pdfParseModule as any).default || pdfParseModule;
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractTextFromHTML(htmlContent: string): string {
  // Parse HTML and extract text, preserving ul/li hierarchy with indentation
  const lines: string[] = [];
  
  // Remove script and style tags first
  let cleaned = htmlContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  
  // Track nesting depth for lists and current text accumulator
  let listDepth = 0;
  let inListItem = false;
  let currentText = '';
  
  // Process the HTML looking for tags
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  let lastIndex = 0;
  let match;
  
  while ((match = tagRegex.exec(cleaned)) !== null) {
    // Accumulate text before this tag
    const textBefore = cleaned.substring(lastIndex, match.index);
    if (textBefore.trim()) {
      currentText += ' ' + textBefore.trim();
    }
    
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    
    if (tagName === 'ul' || tagName === 'ol') {
      if (!isClosing) {
        listDepth++;
      } else {
        listDepth = Math.max(0, listDepth - 1);
      }
    } else if (tagName === 'li') {
      if (!isClosing) {
        // Starting a new list item - flush any previous accumulated text first
        if (currentText.trim() && inListItem) {
          const indent = '  '.repeat(Math.max(0, listDepth - 1));
          lines.push(indent + '- ' + currentText.trim());
          currentText = '';
        }
        inListItem = true;
      } else {
        // Closing list item - flush accumulated text
        if (currentText.trim()) {
          const indent = '  '.repeat(Math.max(0, listDepth - 1));
          lines.push(indent + '- ' + currentText.trim());
          currentText = '';
        }
        inListItem = false;
      }
    } else if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      // Block-level elements - flush text on close
      if (isClosing && currentText.trim()) {
        if (inListItem) {
          // Don't flush here, let </li> handle it
        } else {
          lines.push(currentText.trim());
          currentText = '';
        }
      }
    } else if (tagName === 'br') {
      // Line break - add space to current text
      currentText += ' ';
    }
    
    lastIndex = match.index + fullTag.length;
  }
  
  // Get any remaining text after last tag
  const remainingText = cleaned.substring(lastIndex).trim();
  if (remainingText) {
    currentText += ' ' + remainingText;
  }
  if (currentText.trim()) {
    lines.push(currentText.trim());
  }
  
  // Decode HTML entities and clean up
  return lines
    .map(line => line
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    )
    .filter(line => line.length > 0)
    .join('\n');
}

async function fetchWorkflowyContent(nodeIdOrUrl: string): Promise<string> {
  const apiKey = process.env.WORKFLOWY_API_KEY;
  if (!apiKey) {
    throw new Error('Workflowy API key not configured');
  }

  let nodeId: string | null = null;
  
  const shareMatch = nodeIdOrUrl.match(/workflowy\.com\/#\/([a-zA-Z0-9-]+)/);
  if (shareMatch) {
    nodeId = shareMatch[1];
  } else if (nodeIdOrUrl.match(/^[a-zA-Z0-9-]+$/)) {
    nodeId = nodeIdOrUrl;
  }

  let apiUrl: string;
  if (nodeId) {
    apiUrl = `https://workflowy.com/api/v1/nodes?parent_id=${nodeId}`;
  } else {
    apiUrl = 'https://workflowy.com/api/v1/nodes-export';
  }

  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid Workflowy API key');
    }
    throw new Error(`Failed to fetch Workflowy content: ${response.status}`);
  }

  const data = await response.json();
  const nodes = data.nodes || [];

  function buildNodeText(node: any, indent: number = 0): string {
    const prefix = '  '.repeat(indent);
    let text = `${prefix}- ${node.name || ''}`;
    if (node.note) {
      text += `\n${prefix}  Note: ${node.note}`;
    }
    return text;
  }

  function sortByPriority(nodes: any[]): any[] {
    return [...nodes].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  const sortedNodes = sortByPriority(nodes);
  const textContent = sortedNodes.map(n => buildNodeText(n)).join('\n');
  
  return textContent.trim();
}

async function fetchGoogleDocsContent(url: string): Promise<string> {
  const docIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!docIdMatch) {
    throw new Error('Invalid Google Docs URL format');
  }
  
  const docId = docIdMatch[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  
  const response = await fetch(exportUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Google Doc is not publicly accessible. Please make sure link sharing is enabled.');
    }
    throw new Error(`Failed to fetch Google Doc: ${response.status}`);
  }
  
  return response.text();
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function generateUniqueSlug(title: string): Promise<string> {
  let baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const existing = await storage.getBrainliftBySlug(slug);
    if (!existing) {
      return slug;
    }
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

async function saveBrainliftFromAI(data: BrainliftOutput, originalContent?: string, sourceType?: string) {
  const slug = await generateUniqueSlug(data.title);
  
  const facts = data.facts.map((f) => ({
    originalId: f.id,
    category: f.category,
    fact: f.fact,
    score: f.score,
    contradicts: f.contradicts,
  }));
  
  const clusters = data.contradictionClusters.map((c) => ({
    name: c.name,
    tension: c.tension,
    status: c.status,
    factIds: c.factIds,
    claims: c.claims,
  }));
  
  const readingList = data.readingList.map((r) => ({
    type: r.type,
    author: r.author,
    topic: r.topic,
    time: r.time,
    facts: r.facts,
    url: r.url,
  }));

  return storage.createBrainlift(
    {
      slug,
      title: data.title,
      description: data.description,
      author: null,
      summary: data.summary,
      classification: data.classification,
      rejectionReason: data.rejectionReason || null,
      rejectionSubtype: data.rejectionSubtype || null,
      rejectionRecommendation: data.rejectionRecommendation || null,
      originalContent: originalContent || null,
      sourceType: sourceType || null,
    },
    facts,
    clusters,
    readingList
  );
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.brainlifts.list.path, async (req, res) => {
    const brainlifts = await storage.getAllBrainlifts();
    res.json(brainlifts);
  });

  app.get(api.brainlifts.get.path, async (req, res) => {
    const brainlift = await storage.getBrainliftBySlug(req.params.slug);
    if (!brainlift) {
      return res.status(404).json({ message: "Brainlift not found" });
    }
    res.json(brainlift);
  });

  app.post(api.brainlifts.create.path, async (req, res) => {
    try {
      const input = api.brainlifts.create.input.parse(req.body);
      const brainlift = await storage.createBrainlift(
        {
          slug: input.slug,
          title: input.title,
          description: input.description,
          author: input.author || null,
          summary: input.summary
        },
        input.facts,
        input.contradictionClusters,
        input.readingList
      );
      res.status(201).json(brainlift);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post('/api/brainlifts/import', upload.single('file'), async (req, res) => {
    try {
      const sourceType = req.body.sourceType as string;
      let content: string;
      let sourceLabel: string;

      switch (sourceType) {
        case 'pdf':
          if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
          }
          content = await extractTextFromPDF(req.file.buffer);
          sourceLabel = 'PDF document';
          break;

        case 'docx':
          if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
          }
          content = await extractTextFromDocx(req.file.buffer);
          sourceLabel = 'Word document';
          break;

        case 'html':
          if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
          }
          content = extractTextFromHTML(req.file.buffer.toString('utf-8'));
          sourceLabel = 'HTML file';
          break;

        case 'workflowy':
          const workflowyUrl = req.body.url as string;
          if (!workflowyUrl) {
            return res.status(400).json({ message: 'No Workflowy URL provided' });
          }
          content = await fetchWorkflowyContent(workflowyUrl);
          sourceLabel = 'Workflowy';
          break;

        case 'googledocs':
          const googleUrl = req.body.url as string;
          if (!googleUrl) {
            return res.status(400).json({ message: 'No Google Docs URL provided' });
          }
          content = await fetchGoogleDocsContent(googleUrl);
          sourceLabel = 'Google Docs';
          break;

        case 'text':
          const textContent = req.body.content as string;
          if (!textContent) {
            return res.status(400).json({ message: 'No text content provided' });
          }
          content = textContent;
          sourceLabel = 'text content';
          break;

        default:
          return res.status(400).json({ message: 'Invalid source type' });
      }

      content = content.trim();
      if (!content || content.length < 100) {
        return res.status(400).json({ message: 'Content is too short or empty. Please provide more detailed content (at least 100 characters).' });
      }

      console.log(`Processing ${sourceLabel}, content length: ${content.length} chars`);

      const brainliftData = await extractBrainlift(content, sourceLabel);
      const brainlift = await saveBrainliftFromAI(brainliftData, content, sourceType);

      res.status(201).json(brainlift);
    } catch (err: any) {
      console.error('Import error:', err);
      res.status(500).json({ message: err.message || 'Failed to import brainlift' });
    }
  });

  // Get grades for a brainlift
  app.get('/api/brainlifts/:slug/grades', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }
      const grades = await storage.getGradesByBrainliftId(brainlift.id);
      res.json(grades);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Save a grade for a reading list item
  const gradeSchema = z.object({
    readingListItemId: z.number(),
    aligns: z.enum(['yes', 'no', 'partial']).nullable().optional(),
    contradicts: z.enum(['yes', 'no']).nullable().optional(),
    newInfo: z.enum(['yes', 'no']).nullable().optional(),
    quality: z.number().min(1).max(5).nullable().optional(),
  });

  app.post('/api/grades', async (req, res) => {
    try {
      const parsed = gradeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid grade data', errors: parsed.error.errors });
      }
      const { readingListItemId, aligns, contradicts, newInfo, quality } = parsed.data;
      const grade = await storage.saveGrade({
        readingListItemId,
        aligns: aligns ?? null,
        contradicts: contradicts ?? null,
        newInfo: newInfo ?? null,
        quality: quality ?? null,
      });
      res.json(grade);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update brainlift (import new version)
  app.patch('/api/brainlifts/:slug/update', upload.single('file'), async (req, res) => {
    try {
      const { slug } = req.params;
      const sourceType = req.body.sourceType as string;
      let content: string;
      let sourceLabel: string;

      switch (sourceType) {
        case 'pdf':
          if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
          }
          content = await extractTextFromPDF(req.file.buffer);
          sourceLabel = 'PDF document';
          break;

        case 'docx':
          if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
          }
          content = await extractTextFromDocx(req.file.buffer);
          sourceLabel = 'Word document';
          break;

        case 'html':
          if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
          }
          content = extractTextFromHTML(req.file.buffer.toString('utf-8'));
          sourceLabel = 'HTML file';
          break;

        case 'workflowy':
          const workflowyUrl = req.body.url as string;
          if (!workflowyUrl) {
            return res.status(400).json({ message: 'No Workflowy URL provided' });
          }
          content = await fetchWorkflowyContent(workflowyUrl);
          sourceLabel = 'Workflowy';
          break;

        case 'googledocs':
          const googleUrl = req.body.url as string;
          if (!googleUrl) {
            return res.status(400).json({ message: 'No Google Docs URL provided' });
          }
          content = await fetchGoogleDocsContent(googleUrl);
          sourceLabel = 'Google Docs';
          break;

        case 'text':
          const textContent = req.body.content as string;
          if (!textContent) {
            return res.status(400).json({ message: 'No text content provided' });
          }
          content = textContent;
          sourceLabel = 'text content';
          break;

        default:
          return res.status(400).json({ message: 'Invalid source type' });
      }

      content = content.trim();
      if (!content || content.length < 100) {
        return res.status(400).json({ message: 'Content is too short or empty. Please provide more detailed content (at least 100 characters).' });
      }

      console.log(`Updating ${slug} with ${sourceLabel}, content length: ${content.length} chars`);

      const brainliftData = await extractBrainlift(content, sourceLabel);
      
      const facts = brainliftData.facts.map((f) => ({
        originalId: f.id,
        category: f.category,
        fact: f.fact,
        score: f.score,
        contradicts: f.contradicts,
      }));
      
      const clusters = brainliftData.contradictionClusters.map((c) => ({
        name: c.name,
        tension: c.tension,
        status: c.status,
        factIds: c.factIds,
        claims: c.claims,
      }));
      
      const readingList = brainliftData.readingList.map((r) => ({
        type: r.type,
        author: r.author,
        topic: r.topic,
        time: r.time,
        facts: r.facts,
        url: r.url,
      }));

      const updatedBrainlift = await storage.updateBrainlift(
        slug,
        {
          slug,
          title: brainliftData.title,
          description: brainliftData.description,
          author: (brainliftData as any).author || null,
          summary: brainliftData.summary,
          classification: brainliftData.classification,
          rejectionReason: brainliftData.rejectionReason || null,
          rejectionSubtype: brainliftData.rejectionSubtype || null,
          rejectionRecommendation: brainliftData.rejectionRecommendation || null,
          originalContent: content,
          sourceType: sourceType,
        },
        facts,
        clusters,
        readingList
      );

      res.json(updatedBrainlift);
    } catch (err: any) {
      console.error('Update error:', err);
      res.status(500).json({ message: err.message || 'Failed to update brainlift' });
    }
  });

  // Get version history for a brainlift
  app.get('/api/brainlifts/:slug/versions', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }
      const versions = await storage.getVersionsByBrainliftId(brainlift.id);
      res.json(versions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Search for new resources using Perplexity
  app.post('/api/brainlifts/:slug/research', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }

      const { mode, query } = req.body;
      const existingTopics = brainlift.readingList.map(r => r.topic);

      // Get experts sorted by rankScore (highest first) for prioritized search
      const experts = await storage.getFollowedExperts(brainlift.id);
      const sortedExperts = [...experts].sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0));
      const prioritizedExpertNames = sortedExperts.map(e => e.name);

      // Get existing feedback for research sources to improve results
      const existingFeedback = await storage.getSourceFeedback(brainlift.id, 'research');
      const feedbackItems = existingFeedback.map(f => ({
        url: f.url,
        title: f.title,
        summary: f.snippet,
        decision: f.decision as 'accepted' | 'rejected',
      }));

      // Get graded sources to inform quality preferences
      const gradedReadingList = await storage.getGradedReadingList(brainlift.id);
      const gradedSources = gradedReadingList.map(item => ({
        type: item.type,
        author: item.author,
        topic: item.topic,
        url: item.url,
        quality: item.quality,
        aligns: item.aligns,
      }));

      let result;
      if (mode === 'deep') {
        const factTexts = brainlift.facts.map(f => f.fact);
        result = await deepResearch(
          brainlift.title,
          brainlift.description,
          factTexts,
          feedbackItems,
          gradedSources,
          prioritizedExpertNames,
          query
        );
      } else {
        result = await searchForResources(
          brainlift.title,
          brainlift.description,
          existingTopics,
          feedbackItems,
          gradedSources,
          prioritizedExpertNames
        );
      }

      res.json(result);
    } catch (err: any) {
      console.error('Research error:', err);
      res.status(500).json({ message: err.message || 'Failed to perform research' });
    }
  });

  // Add a resource from research to reading list
  app.post('/api/brainlifts/:slug/reading-list', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }

      const { type, author, topic, time, facts, url } = req.body;
      
      const newItem = await storage.addReadingListItem(brainlift.id, {
        type,
        author,
        topic,
        time,
        facts: facts || '',
        url,
      });

      res.json(newItem);
    } catch (err: any) {
      console.error('Add reading list item error:', err);
      res.status(500).json({ message: err.message || 'Failed to add reading list item' });
    }
  });

  // Search Twitter for relevant tweets
  app.post('/api/brainlifts/:slug/tweets', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }

      const facts = brainlift.facts.map(f => ({
        id: f.originalId || `${f.id}`,
        fact: f.fact,
        source: f.source || '',
      }));

      // Extract expert names from fact sources and reading list authors
      const expertSources = brainlift.facts
        .map(f => f.source || '')
        .filter(s => s.length > 0);
      
      const expertAuthors = brainlift.readingList
        .map(r => r.author || '')
        .filter(a => a.length > 0);

      // Get followed experts sorted by rankScore (highest first) to prioritize their tweets
      const followedExperts = await storage.getFollowedExperts(brainlift.id);
      const sortedExperts = [...followedExperts].sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0));
      const followedHandles = sortedExperts
        .filter(e => e.twitterHandle)
        .map(e => e.twitterHandle!.replace('@', ''));
      
      // Build expert objects with name and handle properly paired for similar accounts
      const prioritizedExperts = sortedExperts.map(e => ({
        name: e.name,
        handle: e.twitterHandle?.replace('@', ''),
      }));

      // Get existing feedback to improve search
      const existingFeedback = await storage.getSourceFeedback(brainlift.id, 'tweet');
      const feedbackItems = existingFeedback.map(f => ({
        tweetId: f.sourceId,
        authorUsername: f.title,
        text: f.snippet,
        decision: f.decision as 'accepted' | 'rejected',
      }));

      // Get graded sources to inform quality preferences
      const gradedReadingList = await storage.getGradedReadingList(brainlift.id);
      const gradedSources = gradedReadingList.map(item => ({
        type: item.type,
        author: item.author,
        topic: item.topic,
        url: item.url,
        quality: item.quality,
        aligns: item.aligns,
      }));

      const result = await searchRelevantTweets(
        brainlift.title,
        brainlift.description,
        facts,
        expertSources,
        expertAuthors,
        feedbackItems,
        gradedSources,
        followedHandles,
        prioritizedExperts
      );

      res.json(result);
    } catch (err: any) {
      console.error('Twitter search error:', err);
      res.status(500).json({ message: err.message || 'Failed to search tweets' });
    }
  });

  // Get source feedback for a brainlift (tweets and research)
  app.get('/api/brainlifts/:slug/feedback', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }

      const sourceType = req.query.sourceType as string | undefined;
      const feedback = await storage.getSourceFeedback(brainlift.id, sourceType);
      res.json(feedback);
    } catch (err: any) {
      console.error('Get source feedback error:', err);
      res.status(500).json({ message: err.message || 'Failed to get source feedback' });
    }
  });

  // Save source feedback (accept/reject) - unified endpoint for tweets and research
  app.post('/api/brainlifts/:slug/feedback', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }

      const feedbackSchema = z.object({
        sourceId: z.string(),
        sourceType: z.enum(['tweet', 'research']),
        title: z.string(),
        snippet: z.string(),
        url: z.string(),
        decision: z.enum(['accepted', 'rejected']),
      });

      const validated = feedbackSchema.parse(req.body);
      
      const saved = await storage.saveSourceFeedback({
        brainliftId: brainlift.id,
        ...validated,
      });

      res.json(saved);
    } catch (err: any) {
      console.error('Save source feedback error:', err);
      res.status(500).json({ message: err.message || 'Failed to save source feedback' });
    }
  });

  // Get experts for a brainlift
  app.get('/api/brainlifts/:slug/experts', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }

      const expertsList = await storage.getExpertsByBrainliftId(brainlift.id);
      res.json(expertsList);
    } catch (err: any) {
      console.error('Get experts error:', err);
      res.status(500).json({ message: err.message || 'Failed to get experts' });
    }
  });

  // Refresh/extract experts for a brainlift using AI
  app.post('/api/brainlifts/:slug/experts/refresh', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }

      const expertsData = await extractAndRankExperts({
        brainliftId: brainlift.id,
        title: brainlift.title,
        description: brainlift.description,
        author: brainlift.author,
        facts: brainlift.facts,
        originalContent: brainlift.originalContent || '',
        readingList: brainlift.readingList || [],
      });

      const saved = await storage.saveExperts(brainlift.id, expertsData);
      res.json(saved);
    } catch (err: any) {
      console.error('Refresh experts error:', err);
      res.status(500).json({ message: err.message || 'Failed to refresh experts' });
    }
  });

  // Update expert following status
  app.patch('/api/experts/:id/follow', async (req, res) => {
    try {
      const expertId = parseInt(req.params.id);
      const { isFollowing } = req.body;
      
      if (typeof isFollowing !== 'boolean') {
        return res.status(400).json({ message: 'isFollowing must be a boolean' });
      }

      const updated = await storage.updateExpertFollowing(expertId, isFollowing);
      res.json(updated);
    } catch (err: any) {
      console.error('Update expert following error:', err);
      res.status(500).json({ message: err.message || 'Failed to update expert' });
    }
  });

  // Delete an expert
  app.delete('/api/experts/:id', async (req, res) => {
    try {
      const expertId = parseInt(req.params.id);
      await storage.deleteExpert(expertId);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete expert error:', err);
      res.status(500).json({ message: err.message || 'Failed to delete expert' });
    }
  });

  // Get followed experts for a brainlift (used by tweet search)
  app.get('/api/brainlifts/:slug/experts/following', async (req, res) => {
    try {
      const brainlift = await storage.getBrainliftBySlug(req.params.slug);
      if (!brainlift) {
        return res.status(404).json({ message: 'Brainlift not found' });
      }

      const followedExperts = await storage.getFollowedExperts(brainlift.id);
      res.json(followedExperts);
    } catch (err: any) {
      console.error('Get followed experts error:', err);
      res.status(500).json({ message: err.message || 'Failed to get followed experts' });
    }
  });

  await seedDatabase();

  return httpServer;
}
