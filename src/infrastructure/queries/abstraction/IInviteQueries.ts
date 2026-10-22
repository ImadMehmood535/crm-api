import { PageRequest } from '@shared/utils/Pagination';

export const INVITE_QUERIES = Symbol('INVITE_QUERIES');

/** The frontend's `Invite` (status already derived: pending past expiry reads `expired`). */
export interface InviteReadModel {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  slug: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface InvitePreviewReadModel {
  email: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  slug: string;
  expiresAt: string;
}

export interface InviteListFilter extends PageRequest {
  status?: string;
}

export interface IInviteQueries {
  findList(filter: InviteListFilter): Promise<{ rows: InviteReadModel[]; total: number }>;
  findById(id: string): Promise<InviteReadModel | null>;
  /** Only a live (pending, unexpired) invite is previewable. */
  findLivePreview(tokenHash: string): Promise<InvitePreviewReadModel | null>;
}
