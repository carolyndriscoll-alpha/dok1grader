import { z } from 'zod';
import { CLASSIFICATION, type Classification } from '@shared/schema';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'anthropic/claude-sonnet-4';

const brainliftOutputSchema = z.object({
  classification: z.enum(['brainlift', 'partial', 'not_brainlift']),
  rejectionReason: z.string().nullable().optional(),
  rejectionSubtype: z.string().nullable().optional(),
  rejectionRecommendation: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  summary: z.object({
    totalFacts: z.number(),
    meanScore: z.string(),
    score5Count: z.number(),
    contradictionCount: z.number(),
  }),
  facts: z.array(z.object({
    id: z.string(),
    category: z.string(),
    fact: z.string(),
    score: z.number().min(1).max(5),
    contradicts: z.string().nullable(),
  })),
  contradictionClusters: z.array(z.object({
    name: z.string(),
    factIds: z.array(z.string()),
    claims: z.array(z.string()),
    tension: z.string(),
    status: z.string(),
  })),
  readingList: z.array(z.object({
    type: z.string(),
    author: z.string(),
    topic: z.string(),
    time: z.string(),
    facts: z.string(),
    url: z.string(),
  })),
});

export type BrainliftOutput = z.infer<typeof brainliftOutputSchema>;

const SYSTEM_PROMPT = `You are an expert educational content analyst specializing in DOK1 (Depth of Knowledge Level 1) grading. Your task is to analyze educational content and produce a structured "brainlift" - a fact-analysis document.

**CRITICAL FIRST STEP - Document Classification:**
Before extracting facts, you MUST classify the document:

- "brainlift" = Contains factual claims about research findings, data, or verifiable assertions (e.g., "Study X found effect size Y", "Data shows Z%")
- "partial" = Contains some factual claims but mixed with prescriptive or operational content
- "not_brainlift" = Contains NO gradeable facts - only prescriptive statements ("You should..."), design specifications, project documents, or reference lists without findings

If classification is "not_brainlift":
- Set rejectionSubtype to describe the document type (e.g., "Design Manual", "Project Spec", "Reference List")
- Set rejectionReason explaining why it cannot be graded
- Set rejectionRecommendation suggesting how to convert it to a brainlift
- Set facts, contradictionClusters, and readingList to empty arrays
- Set summary scores to 0

If classification is "brainlift" or "partial", proceed with full analysis:

1. **Extract Key Facts**: Identify discrete, verifiable facts from the content. Each fact should be a single claim.

2. **Categorize Facts**: Assign each fact to a category such as:
   - "Regulatory" (laws, policies, requirements)
   - "Research" (academic findings, studies)
   - "External Benchmarks" (industry standards, comparisons)
   - "Internal" (organization-specific claims)
   - Other relevant categories based on content

3. **Score Facts (1-5)**:
   - 5 = Verified, well-sourced, externally validated
   - 4 = Likely accurate but needs minor verification
   - 3 = Plausible but unverified or vague
   - 2 = Questionable, potentially misleading
   - 1 = Likely false or highly misleading

4. **Identify Contradiction Clusters**: Find groups of facts that seem to conflict or create tension. Mark which facts contradict each other and describe the tension.

5. **Create Reading List**: Suggest relevant sources for further research. Include type (Twitter, Blog, Research, etc.), author, topic, estimated reading time, and URL if known.

Output ONLY valid JSON matching this exact structure:
{
  "classification": "brainlift" | "partial" | "not_brainlift",
  "rejectionReason": null | "Explanation why document cannot be graded",
  "rejectionSubtype": null | "Document type description",
  "rejectionRecommendation": null | "How to convert to gradeable brainlift",
  "title": "Topic Name",
  "description": "DOK1 Grading - [Topic] Brainlift Analysis",
  "summary": {
    "totalFacts": <number>,
    "meanScore": "<decimal string like 4.17>",
    "score5Count": <number of score-5 facts>,
    "contradictionCount": <number of clusters>
  },
  "facts": [
    { "id": "1", "category": "Category", "fact": "The claim text", "score": 5, "contradicts": null },
    { "id": "2.1", "category": "Category", "fact": "Another claim", "score": 4, "contradicts": "Cluster Name" }
  ],
  "contradictionClusters": [
    {
      "name": "Cluster Name",
      "factIds": ["2.1", "2.2"],
      "claims": ["Claim 1 text", "Claim 2 text"],
      "tension": "Description of the conflict",
      "status": "Flagged"
    }
  ],
  "readingList": [
    { "type": "Research", "author": "Author Name", "topic": "Topic description", "time": "5 min", "facts": "What it covers", "url": "https://..." }
  ]
}

Important:
- ALWAYS set classification first - this determines the rest of the response
- For "not_brainlift" documents, provide helpful rejection fields
- Use decimal IDs like "1", "2", "2.1", "2.2" for related facts
- Be thorough but concise in fact extraction
- Only flag real contradictions, not just related facts
- Estimate realistic reading times
- If URLs are unknown, provide descriptive placeholder like "https://example.com/topic"`;

export async function extractBrainlift(content: string, sourceType: string): Promise<BrainliftOutput> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const userPrompt = `Analyze the following ${sourceType} content and create a DOK1 grading brainlift:

---
${content}
---

Remember to output ONLY valid JSON matching the required structure.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://replit.com',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const messageContent = data.choices?.[0]?.message?.content;

  if (!messageContent) {
    throw new Error('No response from AI model');
  }

  let parsed: any;
  try {
    const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
  }

  const validated = brainliftOutputSchema.safeParse(parsed);
  if (!validated.success) {
    console.error('Validation errors:', validated.error.errors);
    throw new Error(`AI response does not match expected schema: ${validated.error.errors.map(e => e.message).join(', ')}`);
  }

  return validated.data;
}
