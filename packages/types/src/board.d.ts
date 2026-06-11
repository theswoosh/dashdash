import type { Layout } from './layout.js';
export type UserRole = 'admin' | 'editor' | 'viewer';
export type UserSource = 'local' | 'oidc';
export interface User {
    id: string;
    username: string;
    email: string;
    source: UserSource;
    oidcSub?: string;
    role: UserRole;
    createdAt: string;
}
export interface Board {
    id: string;
    slug: string;
    title: string;
    ownerId: string | null;
    isPublic: boolean;
    layout: Layout[];
    createdAt: string;
}
export interface Session {
    userId: string;
    role: UserRole;
}
//# sourceMappingURL=board.d.ts.map