/** A login session behind one refresh token. Rotation replaces it with a successor in the same family. */
export class Session {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _familyId: string,
    private readonly _expiresAt: Date,
    private readonly _revokedAt: Date | null,
    private readonly _replacedBy: string | null,
  ) {}

  static rehydrate(
    id: string,
    userId: string,
    familyId: string,
    expiresAt: Date,
    revokedAt: Date | null,
    replacedBy: string | null,
  ): Session {
    return new Session(id, userId, familyId, expiresAt, revokedAt, replacedBy);
  }

  get id(): string {
    return this._id;
  }
  get userId(): string {
    return this._userId;
  }
  get familyId(): string {
    return this._familyId;
  }

  /** Already exchanged for a successor: presenting it again means the token was stolen. */
  isRotated(): boolean {
    return this._replacedBy !== null;
  }

  isActive(now: Date = new Date()): boolean {
    return this._revokedAt === null && this._replacedBy === null && this._expiresAt > now;
  }
}
