import { requiredText } from '@shared/domain/Guards';
import { ValidationFailedError } from '@shared/errors/AppError';

import { UserStatus } from './UserStatus';

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string, field = 'email'): string {
  const email = (value ?? '').trim().toLowerCase();
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw ValidationFailedError.forField(field, 'Enter a valid email address.');
  }
  return email;
}

export interface NewUserProps {
  email: string;
  firstName: string;
  lastName: string;
  createdBy: string | null;
}

/** A person on either plane. organizationId null = platform operator. */
export class User {
  private constructor(
    private readonly _id: string | null,
    private readonly _organizationId: string | null,
    private readonly _email: string,
    private _firstName: string,
    private _lastName: string,
    private _status: UserStatus,
    private readonly _createdBy: string | null,
  ) {}

  /** A member of a company (its owner or staff). */
  static createTenantUser(organizationId: string, props: NewUserProps): User {
    return User.createIn(organizationId, props);
  }

  static createPlatformAdmin(props: NewUserProps): User {
    return User.createIn(null, props);
  }

  private static createIn(organizationId: string | null, props: NewUserProps): User {
    const user = new User(
      null,
      organizationId,
      normalizeEmail(props.email),
      '',
      '',
      'active',
      props.createdBy,
    );
    user.rename(props.firstName, props.lastName);
    return user;
  }

  static rehydrate(
    id: string,
    organizationId: string | null,
    email: string,
    firstName: string,
    lastName: string,
    status: UserStatus,
    createdBy: string | null,
  ): User {
    return new User(id, organizationId, email, firstName, lastName, status, createdBy);
  }

  get id(): string | null {
    return this._id;
  }
  get organizationId(): string | null {
    return this._organizationId;
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
  get status(): UserStatus {
    return this._status;
  }
  get createdBy(): string | null {
    return this._createdBy;
  }

  rename(firstName: string, lastName: string): void {
    this._firstName = requiredText(firstName, 'firstName', 'First name', NAME_MAX_LENGTH);
    this._lastName = requiredText(lastName, 'lastName', 'Last name', NAME_MAX_LENGTH);
  }

  deactivate(): void {
    this._status = 'inactive';
  }

  activate(): void {
    this._status = 'active';
  }
}
