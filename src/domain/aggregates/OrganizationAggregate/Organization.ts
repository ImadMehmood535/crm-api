import { requiredText } from '@shared/domain/Guards';
import { ValidationFailedError } from '@shared/errors/AppError';

import { OrganizationStatus } from './OrganizationModel';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 120;
const SLUG_MIN_LENGTH = 2;
const SLUG_MAX_LENGTH = 40;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'app',
  'platform',
  'www',
  'login',
  'support',
  'invespy',
];

/** Lowercases and checks a company slug; reserved words answer 422 SLUG_RESERVED. */
export function normalizeSlug(value: string, field = 'slug'): string {
  const slug = (value ?? '').trim().toLowerCase();
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
    throw ValidationFailedError.forField(
      field,
      `Slug must be ${SLUG_MIN_LENGTH}-${SLUG_MAX_LENGTH} lowercase letters, numbers and single hyphens.`,
    );
  }
  if (RESERVED_SLUGS.includes(slug)) {
    throw ValidationFailedError.forField(field, 'This slug is reserved.', 'SLUG_RESERVED');
  }
  return slug;
}

export function normalizeCompanyName(value: string, field = 'name'): string {
  const name = requiredText(value, field, 'Company name', NAME_MAX_LENGTH);
  if (name.length < NAME_MIN_LENGTH) {
    throw ValidationFailedError.forField(
      field,
      `Company name must be at least ${NAME_MIN_LENGTH} characters.`,
    );
  }
  return name;
}

export interface OrganizationProps {
  name: string;
  slug: string;
  createdBy: string | null;
}

/** A developer company (tenant). Never deleted: suspension keeps its data. */
export class Organization {
  private constructor(
    private readonly _id: string | null,
    private _name: string,
    private _slug: string,
    private _status: OrganizationStatus,
    private readonly _createdBy: string | null,
  ) {}

  static create(props: OrganizationProps): Organization {
    const organization = new Organization(null, '', '', 'active', props.createdBy);
    organization.rename(props.name);
    organization._slug = normalizeSlug(props.slug);
    return organization;
  }

  static rehydrate(
    id: string,
    name: string,
    slug: string,
    status: OrganizationStatus,
    createdBy: string | null,
  ): Organization {
    return new Organization(id, name, slug, status, createdBy);
  }

  get id(): string | null {
    return this._id;
  }
  get name(): string {
    return this._name;
  }
  get slug(): string {
    return this._slug;
  }
  get status(): OrganizationStatus {
    return this._status;
  }
  get createdBy(): string | null {
    return this._createdBy;
  }

  rename(name: string): void {
    this._name = normalizeCompanyName(name);
  }

  /** Returns false when already suspended (idempotent). */
  suspend(): boolean {
    if (this._status === 'suspended') return false;
    this._status = 'suspended';
    return true;
  }

  /** Returns false when already active (idempotent). */
  reactivate(): boolean {
    if (this._status === 'active') return false;
    this._status = 'active';
    return true;
  }
}
