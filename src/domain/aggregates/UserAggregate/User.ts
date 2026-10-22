import { UserStatus } from './UserStatus';

/** A person on either plane. organizationId null = platform operator. */
export class User {
  private constructor(
    private readonly _id: string,
    private readonly _organizationId: string | null,
    private readonly _email: string,
    private readonly _status: UserStatus,
  ) {}

  static rehydrate(
    id: string,
    organizationId: string | null,
    email: string,
    status: UserStatus,
  ): User {
    return new User(id, organizationId, email, status);
  }

  get id(): string {
    return this._id;
  }
  get organizationId(): string | null {
    return this._organizationId;
  }
  get email(): string {
    return this._email;
  }
  get status(): UserStatus {
    return this._status;
  }
}
