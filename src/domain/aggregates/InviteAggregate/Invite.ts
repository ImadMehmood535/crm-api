import { requiredText } from '@shared/domain/Guards';
import { ConflictError, NotFoundError } from '@shared/errors/AppError';

import { normalizeCompanyName, normalizeSlug } from '../OrganizationAggregate/Organization';
import { normalizeEmail } from '../UserAggregate/User';

export const INVITE_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_MAX_LENGTH = 100;

export type StoredInviteStatus = 'pending' | 'accepted' | 'revoked';
export type InviteStatus = StoredInviteStatus | 'expired';

export interface IssueInviteProps {
  email: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  slug: string;
  tokenHash: string;
  invitedBy: string;
}

export const inviteInvalid = (): NotFoundError =>
  new NotFoundError('This invite link is invalid or has expired.', 'INVITE_INVALID');

/** An invitation for a developer company. `expired` is derived, never stored. */
export class Invite {
  private constructor(
    private readonly _id: string | null,
    private readonly _email: string,
    private readonly _firstName: string,
    private readonly _lastName: string,
    private readonly _organizationName: string,
    private readonly _slug: string,
    private _tokenHash: string,
    private _status: StoredInviteStatus,
    private _expiresAt: Date,
    private readonly _invitedBy: string,
    private _acceptedAt: Date | null,
  ) {}

  static issue(props: IssueInviteProps, now: Date = new Date()): Invite {
    return new Invite(
      null,
      normalizeEmail(props.email),
      requiredText(props.firstName, 'firstName', 'First name', NAME_MAX_LENGTH),
      requiredText(props.lastName, 'lastName', 'Last name', NAME_MAX_LENGTH),
      normalizeCompanyName(props.organizationName, 'organizationName'),
      normalizeSlug(props.slug),
      props.tokenHash,
      'pending',
      new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS),
      props.invitedBy,
      null,
    );
  }

  static rehydrate(
    id: string,
    email: string,
    firstName: string,
    lastName: string,
    organizationName: string,
    slug: string,
    tokenHash: string,
    status: StoredInviteStatus,
    expiresAt: Date,
    invitedBy: string,
    acceptedAt: Date | null,
  ): Invite {
    return new Invite(
      id,
      email,
      firstName,
      lastName,
      organizationName,
      slug,
      tokenHash,
      status,
      expiresAt,
      invitedBy,
      acceptedAt,
    );
  }

  get id(): string | null {
    return this._id;
  }
  get email(): string {
    return this._email;
  }
  get firstName(): string {
    return this._firstName;
  }
  get lastName(): string {
    return this._lastName;
  }
  get organizationName(): string {
    return this._organizationName;
  }
  get slug(): string {
    return this._slug;
  }
  get tokenHash(): string {
    return this._tokenHash;
  }
  get status(): StoredInviteStatus {
    return this._status;
  }
  get expiresAt(): Date {
    return this._expiresAt;
  }
  get invitedBy(): string {
    return this._invitedBy;
  }
  get acceptedAt(): Date | null {
    return this._acceptedAt;
  }

  effectiveStatus(now: Date = new Date()): InviteStatus {
    return this._status === 'pending' && this._expiresAt < now ? 'expired' : this._status;
  }

  isLive(now: Date = new Date()): boolean {
    return this.effectiveStatus(now) === 'pending';
  }

  /** Resend: a fresh token and expiry, for pending and expired invites. */
  renew(tokenHash: string, now: Date = new Date()): void {
    if (this._status !== 'pending') {
      throw new ConflictError(
        'INVITE_NOT_PENDING',
        `This invite is ${this._status} and cannot be resent.`,
      );
    }
    this._tokenHash = tokenHash;
    this._expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);
  }

  revoke(): void {
    if (this._status !== 'pending') {
      throw new ConflictError(
        'INVITE_NOT_PENDING',
        `This invite is ${this._status} and cannot be revoked.`,
      );
    }
    this._status = 'revoked';
  }

  /** Only a live invite can be accepted; anything else looks like a bad link. */
  accept(now: Date = new Date()): void {
    if (!this.isLive(now)) throw inviteInvalid();
    this._status = 'accepted';
    this._acceptedAt = now;
  }
}
