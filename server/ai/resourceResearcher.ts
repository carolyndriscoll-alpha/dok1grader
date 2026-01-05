import { z } from 'zod';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PERPLEXITY_MODEL = 'perplexity/sonar-pro';

const resourceSchema = z.object({
  type: z.string(),
  author: z.string(),
  title: z.string(),
  topic: z.string(),
  time: z.string(),
  url: z.string(),
  summary: z.string(),
  relevance: z.string(),
});

const researchResultSchema = z.object({
  resources: z.array(resourceSchema),
  searchSummary: z.string(),
});

export type ResourceResult = z.infer<typeof resourceSchema>;
export type ResearchResult = z.infer<typeof researchResultSchema> & {
  suggestedResearchers?: SuggestedResearcher[];
};

export interface SuggestedResearcher {
  name: string;
  affiliation: string;
  focus: string;
  reason: string;
  similarTo: string;
}

export interface ResearchFeedbackItem {
  url: string;
  title: string;
  summary: string;
  decision: 'accepted' | 'rejected';
}

export interface GradedSourceItem {
  type: string;
  author: string;
  topic: string;
  url: string;
  quality: number | null;
  aligns: string | null;
}

export async function searchForResources(
  brainliftTitle: string,
  brainliftDescription: string,
  existingTopics: string[],
  feedbackItems: ResearchFeedbackItem[] = [],
  gradedSources: GradedSourceItem[] = [],
  prioritizedExperts: string[] = [],
  resourceTypes: string[] = ['Substack', 'Twitter', 'Blog', 'Research', 'Academic Paper']
): Promise<ResearchResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const existingContext = existingTopics.length > 0 
    ? `\n\nExisting reading list topics (avoid duplicates):\n${existingTopics.map(t => `- ${t}`).join('\n')}`
    : '';

  const acceptedExamples = feedbackItems.filter(f => f.decision === 'accepted');
  const rejectedUrls = feedbackItems.filter(f => f.decision === 'rejected').map(f => f.url);

  // Use grading data to guide source quality
  const highQualitySources = gradedSources.filter(s => s.quality !== null && s.quality >= 4);
  const lowQualitySources = gradedSources.filter(s => s.quality !== null && s.quality <= 2);
  const aligningSources = gradedSources.filter(s => s.aligns === 'yes');

  const gradingContext = (highQualitySources.length > 0 || lowQualitySources.length > 0)
    ? `\n\nPreviously Graded Sources (use this to understand quality preferences):
${highQualitySources.length > 0 ? `\nHigh-quality sources (find MORE like these - similar authors, topics, source types):
${highQualitySources.slice(0, 5).map(s => `- ${s.type} by ${s.author}: "${s.topic}"`).join('\n')}` : ''}
${lowQualitySources.length > 0 ? `\nLow-quality sources (AVOID similar sources, authors, and approaches):
${lowQualitySources.slice(0, 3).map(s => `- ${s.type} by ${s.author}: "${s.topic}"`).join('\n')}` : ''}
${aligningSources.length > 0 ? `\nSources that aligned well with brainlift facts (prioritize similar sources):
${aligningSources.slice(0, 3).map(s => `- ${s.author}: "${s.topic}"`).join('\n')}` : ''}`
    : '';

  const feedbackContext = feedbackItems.length > 0
    ? `\n\nUser Feedback on Previous Recommendations:
${acceptedExamples.length > 0 ? `\nGood examples (find MORE like these):
${acceptedExamples.slice(0, 5).map(f => `- "${f.title}": ${f.summary}`).join('\n')}` : ''}
${rejectedUrls.length > 0 ? `\nRejected sources (do NOT include these or similar):
${rejectedUrls.map(url => `- ${url}`).join('\n')}` : ''}`
    : '';

  const expertContext = prioritizedExperts.length > 0
    ? `\n\nPRIORITIZED EXPERTS (search for content FROM or ABOUT these experts first, in order of priority):
${prioritizedExperts.slice(0, 10).map((name, i) => `${i + 1}. ${name}`).join('\n')}`
    : '';

  const prompt = `You are a research assistant helping find high-quality educational resources.

Topic: "${brainliftTitle}"
Description: ${brainliftDescription}
${existingContext}${gradingContext}${feedbackContext}${expertContext}

Search the web and find 5-8 high-quality resources related to this educational topic.

PRIORITY ORDER:
1. FIRST search for content BY the prioritized experts listed above (their Substacks, blogs, articles, papers)
2. THEN search for content ABOUT those experts (reviews, discussions of their work)
3. FINALLY, fill remaining slots with other authoritative sources on the topic

Focus on:
- Substacks and newsletters from the prioritized experts
- Twitter/X threads with valuable insights from those experts
- Blog posts from thought leaders
- Academic papers and research studies
- Podcast episodes or video content

For each resource, provide:
1. The type (Substack, Twitter, Blog, Research, Academic Paper, Podcast, Video)
2. The author's name
3. The title of the piece
4. A brief topic description
5. Estimated reading/viewing time
6. The actual URL (must be real, working URLs)
7. A 1-2 sentence summary of key insights
8. Why it's relevant to the brainlift topic

Output ONLY valid JSON in this exact format:
{
  "resources": [
    {
      "type": "Substack",
      "author": "Author Name",
      "title": "Article Title",
      "topic": "Brief topic description",
      "time": "5 min",
      "url": "https://actual-url.com/article",
      "summary": "Key insights from this resource",
      "relevance": "Why this is relevant to the topic"
    }
  ],
  "searchSummary": "Brief summary of what was found and key themes across resources"
}

Important:
- Only include REAL, verifiable URLs that actually exist
- Prioritize recent content (last 2 years when possible)
- Focus on authoritative sources and recognized experts
- Avoid duplicating topics already in the reading list`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://replit.com',
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const messageContent = data.choices?.[0]?.message?.content;

  if (!messageContent) {
    throw new Error('No response from Perplexity model');
  }

  let parsed: any;
  try {
    const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    throw new Error(`Failed to parse research response as JSON: ${e.message}`);
  }

  const validated = researchResultSchema.safeParse(parsed);
  
  // Filter out any rejected URLs from the results
  const filterRejectedUrls = (resources: ResourceResult[]): ResourceResult[] => {
    return resources.filter(r => !rejectedUrls.includes(r.url));
  };
  
  if (!validated.success) {
    console.error('Validation errors:', validated.error.errors);
    return {
      resources: filterRejectedUrls(parsed.resources || []),
      searchSummary: parsed.searchSummary || 'Research completed with partial results',
    };
  }

  // Suggest similar researchers based on expert list
  let suggestedResearchers: SuggestedResearcher[] = [];
  if (prioritizedExperts.length > 0) {
    try {
      suggestedResearchers = await suggestSimilarResearchers(prioritizedExperts, brainliftTitle);
    } catch (err) {
      console.error('Failed to get similar researchers:', err);
    }
  }

  return {
    ...validated.data,
    resources: filterRejectedUrls(validated.data.resources),
    suggestedResearchers,
  };
}

export async function deepResearch(
  brainliftTitle: string,
  brainliftDescription: string,
  facts: string[],
  feedbackItems: ResearchFeedbackItem[] = [],
  gradedSources: GradedSourceItem[] = [],
  prioritizedExperts: string[] = [],
  specificQuery?: string
): Promise<ResearchResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const factsContext = facts.length > 0
    ? `\n\nKey facts from the brainlift to research further:\n${facts.slice(0, 10).map((f, i) => `${i + 1}. ${f}`).join('\n')}`
    : '';

  const queryContext = specificQuery 
    ? `\n\nSpecific research focus: ${specificQuery}`
    : '';

  const acceptedExamples = feedbackItems.filter(f => f.decision === 'accepted');
  const rejectedUrls = feedbackItems.filter(f => f.decision === 'rejected').map(f => f.url);

  // Use grading data to guide source quality
  const highQualitySources = gradedSources.filter(s => s.quality !== null && s.quality >= 4);
  const lowQualitySources = gradedSources.filter(s => s.quality !== null && s.quality <= 2);
  const aligningSources = gradedSources.filter(s => s.aligns === 'yes');

  const gradingContext = (highQualitySources.length > 0 || lowQualitySources.length > 0)
    ? `\n\nPreviously Graded Sources (use this to understand quality preferences):
${highQualitySources.length > 0 ? `\nHigh-quality sources (find MORE like these - similar authors, topics, source types):
${highQualitySources.slice(0, 5).map(s => `- ${s.type} by ${s.author}: "${s.topic}"`).join('\n')}` : ''}
${lowQualitySources.length > 0 ? `\nLow-quality sources (AVOID similar sources, authors, and approaches):
${lowQualitySources.slice(0, 3).map(s => `- ${s.type} by ${s.author}: "${s.topic}"`).join('\n')}` : ''}
${aligningSources.length > 0 ? `\nSources that aligned well with brainlift facts (prioritize similar sources):
${aligningSources.slice(0, 3).map(s => `- ${s.author}: "${s.topic}"`).join('\n')}` : ''}`
    : '';

  const feedbackContext = feedbackItems.length > 0
    ? `\n\nUser Feedback on Previous Recommendations:
${acceptedExamples.length > 0 ? `\nGood examples (find MORE like these):
${acceptedExamples.slice(0, 5).map(f => `- "${f.title}": ${f.summary}`).join('\n')}` : ''}
${rejectedUrls.length > 0 ? `\nRejected sources (do NOT include these or similar):
${rejectedUrls.map(url => `- ${url}`).join('\n')}` : ''}`
    : '';

  const expertContext = prioritizedExperts.length > 0
    ? `\n\nPRIORITIZED EXPERTS (search for content FROM or ABOUT these experts first, in order of priority):
${prioritizedExperts.slice(0, 10).map((name, i) => `${i + 1}. ${name}`).join('\n')}`
    : '';

  const prompt = `You are conducting deep research on an educational topic. Perform a comprehensive multi-step search.

Topic: "${brainliftTitle}"
Description: ${brainliftDescription}
${factsContext}
${queryContext}${gradingContext}${feedbackContext}${expertContext}

Conduct deep research to find:
1. FIRST: Academic papers, research, and publications BY the prioritized experts listed above
2. THEN: Academic papers and peer-reviewed research that support or challenge the facts
3. Expert opinions and analysis from recognized authorities
4. Recent news and developments in this area
5. Counter-arguments and alternative perspectives
6. Primary sources and original data

For each resource found, provide detailed information including real URLs.

Output ONLY valid JSON in this exact format:
{
  "resources": [
    {
      "type": "Academic Paper",
      "author": "Author Name",
      "title": "Paper Title",
      "topic": "Brief topic description",
      "time": "15 min",
      "url": "https://actual-url.com/paper",
      "summary": "Key findings and methodology",
      "relevance": "How this relates to specific facts in the brainlift"
    }
  ],
  "searchSummary": "Comprehensive summary of research findings, key themes, and notable gaps in available information"
}

Important:
- Prioritize peer-reviewed and authoritative sources
- Include diverse perspectives when available
- Note any conflicting findings between sources
- Only include REAL, verifiable URLs`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://replit.com',
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const messageContent = data.choices?.[0]?.message?.content;

  if (!messageContent) {
    throw new Error('No response from Perplexity model');
  }

  let parsed: any;
  try {
    const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    throw new Error(`Failed to parse deep research response as JSON: ${e.message}`);
  }

  const validated = researchResultSchema.safeParse(parsed);
  
  // Filter out any rejected URLs from the results
  const filterRejectedUrls = (resources: ResourceResult[]): ResourceResult[] => {
    return resources.filter(r => !rejectedUrls.includes(r.url));
  };
  
  if (!validated.success) {
    console.error('Validation errors:', validated.error.errors);
    return {
      resources: filterRejectedUrls(parsed.resources || []),
      searchSummary: parsed.searchSummary || 'Deep research completed with partial results',
    };
  }

  // Suggest similar researchers based on expert list
  let suggestedResearchers: SuggestedResearcher[] = [];
  if (prioritizedExperts.length > 0) {
    try {
      suggestedResearchers = await suggestSimilarResearchers(prioritizedExperts, brainliftTitle);
    } catch (err) {
      console.error('Failed to get similar researchers:', err);
    }
  }

  return {
    ...validated.data,
    resources: filterRejectedUrls(validated.data.resources),
    suggestedResearchers,
  };
}

async function suggestSimilarResearchers(
  expertNames: string[],
  brainliftTitle: string
): Promise<SuggestedResearcher[]> {
  if (!OPENROUTER_API_KEY || expertNames.length === 0) {
    return [];
  }

  const expertsContext = expertNames.slice(0, 7).join('\n');

  const prompt = `Based on these education/learning researchers and the topic "${brainliftTitle}", suggest 5-7 similar researchers, authors, or thought leaders whose work would be valuable.

CURRENT EXPERTS:
${expertsContext}

Suggest researchers who:
1. Work in the same field (education, cognitive science, literacy, etc.)
2. Have published relevant research, books, or articles
3. Share similar perspectives or research focus
4. Are recognized authorities in their area

Output ONLY valid JSON array:
[
  {
    "name": "Researcher Full Name",
    "affiliation": "University or Organization",
    "focus": "Their main research focus or specialty",
    "reason": "Brief reason why they're relevant (1 sentence)",
    "similarTo": "Name of expert they're most similar to from the list"
  }
]

Do NOT include researchers already in the list above.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://replit.com',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error('Failed to get similar researcher suggestions');
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return [];

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const suggestions = JSON.parse(jsonMatch[0]);
    return suggestions.slice(0, 7);
  } catch (err) {
    console.error('Error suggesting similar researchers:', err);
    return [];
  }
}
