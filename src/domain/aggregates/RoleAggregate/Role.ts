import { optionalText, requiredText } from '@shared/domain/Guards';
import { ForbiddenError, ValidationFailedError } from '@shared/errors/AppError';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 60;
const DESCRIPTION_MAX_LENGTH = 200;

/** "HR Assistant" → "hr_assistant". */
export function roleCodeFrom(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export interface RoleProps {
  organizationId: string;
  name: string;
  description: string | null;
  permissions: readonly string[];
}

/** A company role: a named set of `module.action` grants. The owner's system role is read-only. */
export class Role {
  private constructor(
    private readonly _id: string | null,
    private readonly _organizationId: string,
    private _name: string,
    private _code: string,
    private _description: string | null,
    private _permissions: string[],
    private readonly _isSystem: boolean,
    private _isActive: boolean,
  ) {}

  static create(props: RoleProps): Role {
    const role = new Role(null, props.organizationId, '', '', null, [], false, true);
    role.rename(props.name);
    role.describe(props.description);
    role.grant(props.permissions);
    return role;
  }

  static rehydrate(
    id: string,
    organizationId: string,
    name: string,
    code: string,
    description: string | null,
    permissions: string[],
    isSystem: boolean,
    isActive: boolean,
  ): Role {
    return new Role(id, organizationId, name, code, description, permissions, isSystem, isActive);
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
  get code(): string {
    return this._code;
  }
  get description(): string | null {
    return this._description;
  }
  get permissions(): readonly string[] {
    return this._permissions;
  }
  get isSystem(): boolean {
    return this._isSystem;
  }
  get isActive(): boolean {
    return this._isActive;
  }

  /** The owner's built-in role can never be changed, deactivated or assigned. */
  assertEditable(): void {
    if (this._isSystem) {
      throw new ForbiddenError(
        'SYSTEM_ROLE_PROTECTED',
        'System roles cannot be changed, deleted or assigned.',
      );
    }
  }

  rename(name: string): void {
    const trimmed = requiredText(name, 'name', 'Role name', NAME_MAX_LENGTH);
    const code = roleCodeFrom(trimmed);
    if (trimmed.length < NAME_MIN_LENGTH || code.length === 0) {
      throw ValidationFailedError.forField(
        'name',
        `Role name must be ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters and contain a letter or digit.`,
      );
    }
    this._name = trimmed;
    this._code = code;
  }

  describe(description: string | null): void {
    this._description = optionalText(
      description,
      'description',
      'Description',
      DESCRIPTION_MAX_LENGTH,
    );
  }

  grant(permissions: readonly string[]): void {
    this._permissions = [...new Set(permissions)].sort();
  }

  deactivate(): void {
    this._isActive = false;
  }
}
