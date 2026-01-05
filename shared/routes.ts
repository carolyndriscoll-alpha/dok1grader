import { z } from 'zod';
import { insertBrainliftSchema, brainlifts, insertFactSchema, insertContradictionClusterSchema, insertReadingListItemSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  brainlifts: {
    list: {
      method: 'GET' as const,
      path: '/api/brainlifts',
      responses: {
        200: z.array(z.custom<typeof brainlifts.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/brainlifts/:slug',
      responses: {
        200: z.custom<typeof brainlifts.$inferSelect & {
          facts: any[], 
          contradictionClusters: any[], 
          readingList: any[]
        }>(),
        404: errorSchemas.notFound,
      },
    },
    // Useful for seeding or admin, though primarily we seed from file
    create: {
      method: 'POST' as const,
      path: '/api/brainlifts',
      input: z.object({
        slug: z.string(),
        title: z.string(),
        description: z.string(),
        author: z.string().optional(),
        summary: z.any(),
        facts: z.array(insertFactSchema.omit({ brainliftId: true })),
        contradictionClusters: z.array(insertContradictionClusterSchema.omit({ brainliftId: true })),
        readingList: z.array(insertReadingListItemSchema.omit({ brainliftId: true })),
      }),
      responses: {
        201: z.custom<typeof brainlifts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type BrainliftListResponse = z.infer<typeof api.brainlifts.list.responses[200]>;
export type BrainliftDetailResponse = z.infer<typeof api.brainlifts.get.responses[200]>;
