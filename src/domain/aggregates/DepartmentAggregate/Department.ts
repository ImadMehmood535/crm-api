import { requiredText } from '@shared/domain/Guards';
import { ValidationFailedError } from '@shared/errors/AppError';

import { nameKey } from '../ProjectAggregate/InventoryText';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;

/** A department name: 2-100 characters, trimmed. Shared by departments and teams. */
export function orgUnitName(value: string, label: string): string {
  const name = requiredText(value, 'name', label, NAME_MAX_LENGTH);
  if (name.length < NAME_MIN_LENGTH) {
    throw ValidationFailedError.forField(
      'name',
      `${label} must be at least ${NAME_MIN_LENGTH} characters.`,
    );
  }
  return name;
}

/** A company department, led by a department head. Deactivated, never deleted. */
export class Department {
  private constructor(
    private readonly _id: string | null,
    private readonly _organizationId: string,
    private _name: string,
    private _headUserId: string | null,
    private _isActive: boolean,
    private readonly _createdBy: string | null,
  ) {}

  static create(
    organizationId: string,
    name: string,
    headUserId: string | null,
    createdBy: string,
  ): Department {
    const department = new Department(null, organizationId, '', headUserId, true, createdBy);
    department.rename(name);
    return department;
  }

  static rehydrate(
    id: string,
    organizationId: string,
    name: string,
    headUserId: string | null,
    isActive: boolean,
  ): Department {
    return new Department(id, organizationId, name, headUserId, isActive, null);
  }

  get id(): string | null {
    return this._id;
  }
  get organizationId(): string {
    return this._organizationId;
  }
  get name(): string {
    return this._name;
  }
  get nameKey(): string {
    return nameKey(this._name);
  }
  get headUserId(): string | null {
    return this._headUserId;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdBy(): string | null {
    return this._createdBy;
  }

  rename(name: string): void {
    this._name = orgUnitName(name, 'Department name');
  }

  assignHead(userId: string | null): void {
    this._headUserId = userId;
  }

  deactivate(): void {
    this._isActive = false;
  }
}
