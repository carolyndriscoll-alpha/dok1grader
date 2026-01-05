import { z } from 'zod';

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const tweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  author_id: z.string(),
  created_at: z.string().optional(),
  public_metrics: z.object({
    retweet_count: z.number(),
    reply_count: z.number(),
    like_count: z.number(),
    quote_count: z.number().optional(),
  }).optional(),
});

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  public_metrics: z.object({
    followers_count: z.number(),
    following_count: z.number(),
    tweet_count: z.number(),
  }).optional(),
});

export interface ClassifiedTweet {
  id: string;
  text: string;
  authorName: string;
  authorUsername: string;
  authorFollowers: number;
  createdAt: string;
  likes: number;
  retweets: number;
  replies: number;
  dokLevel: 1 | 2 | 3;
  dokRationale: string;
  matchedFacts: string[];
  matchedTopics: string[];
  relevanceScore: number;
  url: string;
}

export interface TweetSearchResult {
  tweets: ClassifiedTweet[];
  searchSummary: string;
  queryUsed: string;
  suggestedAccounts?: SuggestedAccount[];
}

export interface SuggestedAccount {
  name: string;
  handle: string;
  reason: string;
  similarTo: string;
}

export interface TweetFeedbackItem {
  tweetId: string;
  authorUsername: string;
  text: string;
  decision: 'accepted' | 'rejected';
}

export interface GradedSourceItem {
  type: string;
  author: string;
  topic: string;
  quality: number | null;
  aligns: string | null;
}

export async function searchRelevantTweets(
  brainliftTitle: string,
  brainliftDescription: string,
  facts: { id: string; fact: string; source: string }[],
  expertSources: string[],
  expertAuthors: string[],
  feedback: TweetFeedbackItem[] = [],
  gradedSources: GradedSourceItem[] = [],
  followedHandles: string[] = [],
  prioritizedExperts: { name: string; handle?: string }[] = [],
  maxResults: number = 20
): Promise<TweetSearchResult> {
  if (!TWITTER_BEARER_TOKEN) {
    throw new Error('Twitter Bearer Token not configured');
  }

  // Build search query from brainlift DOK1 facts and experts
  const searchTerms = extractSearchTermsFromFacts(facts, expertSources, expertAuthors);
  const prioritizedExpertNames = prioritizedExperts.map(e => e.name);
  const query = buildSearchQuery(searchTerms, followedHandles, prioritizedExpertNames);

  // Build lists of accepted/rejected tweet IDs for filtering
  const rejectedTweetIds = new Set(
    feedback.filter(f => f.decision === 'rejected').map(f => f.tweetId)
  );
  const acceptedExamples = feedback.filter(f => f.decision === 'accepted').slice(0, 3);
  const rejectedExamples = feedback.filter(f => f.decision === 'rejected').slice(0, 3);

  // Search Twitter
  let tweets;
  try {
    tweets = await searchTwitter(query, maxResults);
  } catch (err: any) {
    throw new Error(`Twitter search failed: ${err.message}`);
  }
  
  // Filter out previously rejected tweets
  tweets = tweets.filter(t => !rejectedTweetIds.has(t.id));
  
  if (tweets.length === 0) {
    return {
      tweets: [],
      searchSummary: 'No tweets found matching your brainlift topics.',
      queryUsed: query,
    };
  }

  // Classify tweets with DOK levels, passing feedback examples and graded sources
  let classifiedTweets;
  try {
    classifiedTweets = await classifyTweetsWithDOK(tweets, facts, expertSources, acceptedExamples, rejectedExamples, gradedSources);
  } catch (err: any) {
    throw new Error(`Tweet classification failed: ${err.message}`);
  }

  if (classifiedTweets.length === 0) {
    return {
      tweets: [],
      searchSummary: `Found ${tweets.length} tweets but none met the relevance threshold for your brainlift.`,
      queryUsed: query,
    };
  }

  // Suggest similar accounts based on expert list (runs in parallel with results)
  let suggestedAccounts: SuggestedAccount[] = [];
  if (prioritizedExperts.length > 0) {
    try {
      suggestedAccounts = await suggestSimilarAccounts(
        prioritizedExperts,
        brainliftTitle
      );
    } catch (err) {
      console.error('Failed to get similar accounts:', err);
    }
  }

  return {
    tweets: classifiedTweets,
    searchSummary: `Found ${classifiedTweets.length} relevant tweets about "${brainliftTitle}"`,
    queryUsed: query,
    suggestedAccounts,
  };
}

function extractSearchTermsFromFacts(
  facts: { id: string; fact: string; source: string }[],
  expertSources: string[],
  expertAuthors: string[]
): string[] {
  const terms: string[] = [];
  
  // Extract expert names from sources (e.g., "Hochman & Wexler", "David Yeager")
  const namePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  const allSources = [...expertSources, ...expertAuthors];
  
  for (const source of allSources) {
    const names = source.match(namePattern);
    if (names) {
      for (const name of names) {
        // Skip common words that look like names
        if (!['The', 'How', 'What', 'Why', 'Learning', 'Teaching', 'Writing', 'Reading'].includes(name)) {
          terms.push(name);
        }
      }
    }
  }
  
  // Extract key phrases from facts (look for quoted terms, specific concepts)
  for (const fact of facts.slice(0, 10)) {
    // Extract quoted phrases
    const quotes = fact.fact.match(/"([^"]+)"/g);
    if (quotes) {
      terms.push(...quotes.slice(0, 2));
    }
    
    // Extract key educational terms from fact text
    const eduTerms = ['cognitive load', 'working memory', 'explicit instruction', 'direct instruction', 
                      'writing revolution', 'science of reading', 'mathemagenic', 'wise feedback',
                      'pedagogical content knowledge', 'knowledge rich'];
    for (const term of eduTerms) {
      if (fact.fact.toLowerCase().includes(term)) {
        terms.push(`"${term}"`);
      }
    }
  }
  
  // Deduplicate and limit
  const unique = Array.from(new Set(terms));
  return unique.slice(0, 8);
}

function buildSearchQuery(
  phrases: string[], 
  followedHandles: string[] = [],
  expertNames: string[] = []
): string {
  const baseFilters = '-is:retweet lang:en';
  
  // Build comprehensive expert-focused query parts
  const queryParts: string[] = [];
  
  // 1. Tweets FROM experts (highest priority)
  if (followedHandles.length > 0) {
    const fromFilters = followedHandles.slice(0, 5).map(h => `from:${h}`).join(' OR ');
    queryParts.push(`(${fromFilters})`);
  }
  
  // 2. Tweets MENTIONING experts (@mentions)
  if (followedHandles.length > 0) {
    const mentionFilters = followedHandles.slice(0, 5).map(h => `@${h}`).join(' OR ');
    queryParts.push(`(${mentionFilters})`);
  }
  
  // 3. Tweets ABOUT experts (by name)
  if (expertNames.length > 0) {
    const nameFilters = expertNames.slice(0, 5).map(n => `"${n}"`).join(' OR ');
    queryParts.push(`(${nameFilters})`);
  }
  
  // 4. Topic phrases from brainlift content
  if (phrases.length > 0) {
    const phrasePart = phrases.slice(0, 5).join(' OR ');
    queryParts.push(`(${phrasePart})`);
  }
  
  // Combine all parts with OR
  if (queryParts.length === 0) {
    return `("education" OR "teaching" OR "learning") ${baseFilters}`;
  }
  
  const combinedQuery = queryParts.join(' OR ');
  return `(${combinedQuery}) (education OR teaching OR writing OR learning OR instruction) ${baseFilters}`;
}

async function searchTwitter(query: string, maxResults: number): Promise<any[]> {
  const url = new URL('https://api.twitter.com/2/tweets/search/recent');
  url.searchParams.set('query', query);
  url.searchParams.set('max_results', Math.min(maxResults, 100).toString());
  url.searchParams.set('tweet.fields', 'created_at,public_metrics,author_id');
  url.searchParams.set('user.fields', 'name,username,public_metrics');
  url.searchParams.set('expansions', 'author_id');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('X API error:', response.status, errorText);
    if (response.status === 401) {
      throw new Error('X API authentication failed. Please verify your TWITTER_BEARER_TOKEN is valid and has not expired.');
    }
    if (response.status === 403) {
      throw new Error('X API access denied. Your API plan may not include search access, or the token lacks required permissions.');
    }
    throw new Error(`X API error (${response.status}). Please check your API credentials.`);
  }

  const data = await response.json();
  
  if (!data.data || data.data.length === 0) {
    return [];
  }

  // Merge user data with tweets
  const usersMap = new Map<string, any>();
  if (data.includes?.users) {
    for (const user of data.includes.users) {
      usersMap.set(user.id, user);
    }
  }

  return data.data.map((tweet: any) => ({
    ...tweet,
    author: usersMap.get(tweet.author_id) || { name: 'Unknown', username: 'unknown', public_metrics: { followers_count: 0 } },
  }));
}

async function classifyTweetsWithDOK(
  tweets: any[],
  facts: { id: string; fact: string }[],
  topics: string[],
  acceptedExamples: TweetFeedbackItem[] = [],
  rejectedExamples: TweetFeedbackItem[] = [],
  gradedSources: GradedSourceItem[] = []
): Promise<ClassifiedTweet[]> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const factsText = facts.slice(0, 15).map(f => `${f.id}: ${f.fact}`).join('\n');
  const topicsText = topics.join(', ');

  // Use graded sources to inform quality preferences
  const highQualitySources = gradedSources.filter(s => s.quality !== null && s.quality >= 4);
  const lowQualitySources = gradedSources.filter(s => s.quality !== null && s.quality <= 2);
  const twitterAuthors = gradedSources.filter(s => s.type.toLowerCase() === 'twitter' && s.quality !== null && s.quality >= 4).map(s => s.author);

  let gradingSection = '';
  if (highQualitySources.length > 0 || lowQualitySources.length > 0) {
    gradingSection = '\n\nGRADED SOURCE QUALITY PREFERENCES:';
    if (twitterAuthors.length > 0) {
      gradingSection += `\nHigh-quality Twitter authors (prioritize tweets from these users): ${twitterAuthors.slice(0, 5).join(', ')}`;
    }
    if (highQualitySources.length > 0) {
      gradingSection += `\nTopics from high-quality sources (prioritize similar content): ${highQualitySources.slice(0, 5).map(s => s.topic).join('; ')}`;
    }
    if (lowQualitySources.length > 0) {
      gradingSection += `\nTopics from low-quality sources (deprioritize similar content): ${lowQualitySources.slice(0, 3).map(s => s.topic).join('; ')}`;
    }
    gradingSection += '\n';
  }

  let feedbackSection = '';
  if (acceptedExamples.length > 0 || rejectedExamples.length > 0) {
    feedbackSection = '\n\nUSER FEEDBACK EXAMPLES (learn from these):';
    if (acceptedExamples.length > 0) {
      feedbackSection += '\nAccepted tweets (similar tweets should score high):';
      acceptedExamples.forEach((ex, i) => {
        feedbackSection += `\n  ${i+1}. @${ex.authorUsername}: "${ex.text.slice(0, 150)}..."`;
      });
    }
    if (rejectedExamples.length > 0) {
      feedbackSection += '\nRejected tweets (similar tweets should be filtered out):';
      rejectedExamples.forEach((ex, i) => {
        feedbackSection += `\n  ${i+1}. @${ex.authorUsername}: "${ex.text.slice(0, 150)}..."`;
      });
    }
    feedbackSection += '\n';
  }

  const prompt = `You are analyzing tweets for educational relevance and depth of knowledge (DOK).${gradingSection}${feedbackSection}

BRAINLIFT FACTS:
${factsText}

BRAINLIFT TOPICS: ${topicsText}

TWEETS TO ANALYZE:
${tweets.map((t, i) => `[${i}] @${t.author.username}: ${t.text}`).join('\n\n')}

For each tweet, determine:
1. DOK Level:
   - DOK1: Tweet states or recalls a fact (simple recall, definition, basic information)
   - DOK2: Tweet applies, analyzes, or explains concepts (comparison, cause-effect, examples)
   - DOK3: Tweet synthesizes, evaluates, or extends thinking (critique, novel connections, deep analysis)

2. Which facts from the brainlift it relates to (by ID, e.g., "1.1", "2.3")
3. Which topics it matches
4. Relevance score (0.0 to 1.0)

Output ONLY valid JSON array:
[
  {
    "index": 0,
    "dokLevel": 1,
    "dokRationale": "States a basic fact about...",
    "matchedFacts": ["1.1", "1.2"],
    "matchedTopics": ["topic1"],
    "relevanceScore": 0.85
  }
]

IMPORTANT FILTERING RULES:
- Include DOK1 (facts), DOK2 (analysis), and DOK3 (synthesis) tweets - all are valuable
- relevanceScore >= 0.5 required (0.0 = unrelated, 1.0 = perfectly relevant)
- Must have at least ONE matched fact OR matched topic
- Skip tweets that are purely promotional or off-topic
- Be generous with relevance - if the tweet discusses topics related to the brainlift, include it`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://replit.com',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-4.5-opus',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from classification model');
  }

  let classifications: any[];
  try {
    // Strip markdown code blocks if present
    let cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    
    // Look for JSON array with objects, or empty array
    const jsonMatchWithObjects = cleanContent.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    const emptyArrayMatch = cleanContent.match(/\[\s*\]/);
    
    const jsonMatch = jsonMatchWithObjects || emptyArrayMatch;
    if (!jsonMatch) {
      console.error('DOK classification response did not contain valid JSON array:', content.substring(0, 500));
      throw new Error('Classification response did not contain valid JSON array');
    }
    classifications = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(classifications)) {
      throw new Error('Parsed content is not an array');
    }
  } catch (e: any) {
    console.error('Failed to parse DOK classifications:', e.message);
    throw new Error(`Failed to parse classification response: ${e.message}`);
  }

  // Merge classifications with tweet data
  const classifiedTweets: ClassifiedTweet[] = [];
  
  for (const classification of classifications) {
    const tweet = tweets[classification.index];
    if (!tweet) continue;
    
    // Filter: require relevance >= 0.5 AND at least one matched fact or topic
    const hasMatches = (classification.matchedFacts?.length > 0) || (classification.matchedTopics?.length > 0);
    if (classification.relevanceScore < 0.5 || !hasMatches) {
      continue;
    }

    classifiedTweets.push({
      id: tweet.id,
      text: tweet.text,
      authorName: tweet.author.name,
      authorUsername: tweet.author.username,
      authorFollowers: tweet.author.public_metrics?.followers_count || 0,
      createdAt: tweet.created_at || new Date().toISOString(),
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0,
      dokLevel: classification.dokLevel as 1 | 2 | 3,
      dokRationale: classification.dokRationale,
      matchedFacts: classification.matchedFacts || [],
      matchedTopics: classification.matchedTopics || [],
      relevanceScore: classification.relevanceScore,
      url: `https://twitter.com/${tweet.author.username}/status/${tweet.id}`,
    });
  }

  // Sort by relevance score descending
  return classifiedTweets.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

async function suggestSimilarAccounts(
  experts: { name: string; handle?: string }[],
  brainliftTitle: string
): Promise<SuggestedAccount[]> {
  if (!OPENROUTER_API_KEY || experts.length === 0) {
    return [];
  }

  const expertsContext = experts.slice(0, 7).map(expert => {
    return `${expert.name}${expert.handle ? ` (@${expert.handle})` : ''}`;
  }).join('\n');

  const prompt = `Based on these education/learning experts and the topic "${brainliftTitle}", suggest 5-7 similar Twitter/X accounts that would post relevant content.

CURRENT EXPERTS:
${expertsContext}

Suggest accounts that are:
1. In the same field (education, cognitive science, literacy, etc.)
2. Share similar perspectives or research focus
3. Would post DOK1 level factual content
4. Have active Twitter presence

Output ONLY valid JSON array:
[
  {
    "name": "Expert Full Name",
    "handle": "twitter_handle",
    "reason": "Brief reason why they're relevant (1 sentence)",
    "similarTo": "Name of expert they're most similar to"
  }
]

Do NOT include experts already in the list above.`;

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
      console.error('Failed to get similar accounts suggestions');
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
    console.error('Error suggesting similar accounts:', err);
    return [];
  }
}
