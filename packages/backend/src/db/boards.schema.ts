import { z } from 'zod';

export const BoardRoleSchema = z.enum(['viewer', 'editor', 'admin', 'owner']);
export type BoardRole = z.infer<typeof BoardRoleSchema>;

export const AuthMethodSchema = z.enum(['local', 'oidc']);
export type AuthMethod = z.infer<typeof AuthMethodSchema>;

export const FlexibleSettingsSchema = z.record(z.string(), z.unknown()).default({});
export type FlexibleSettings = z.infer<typeof FlexibleSettingsSchema>;

export const CreateBoardSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(255),
  yamlPath: z.string().min(1),
  theme: z.string().default('liquid-glass'),
  wallpaperUrl: z.string().url().nullable().default(null),
  brightness: z.number().int().min(0).max(100).default(100),
  settings: FlexibleSettingsSchema,
});
export type CreateBoard = z.infer<typeof CreateBoardSchema>;

export const UpdateBoardOverridesSchema = z.object({
  theme: z.string().nullable().optional(),
  wallpaperUrl: z.string().url().nullable().optional(),
  brightness: z.number().int().min(0).max(100).nullable().optional(),
  overrides: FlexibleSettingsSchema.optional(),
});
export type UpdateBoardOverrides = z.infer<typeof UpdateBoardOverridesSchema>;
