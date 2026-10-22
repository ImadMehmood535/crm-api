import { nameKey } from '../ProjectAggregate/InventoryText';
import { orgUnitName } from '../DepartmentAggregate/Department';

/** A team inside one department. Members may belong to many teams. Deactivated, never deleted. */
export class Team {
  private constructor(
    private readonly _id: string | null,
    private readonly _organizationId: string,
    private readonly _departmentId: string,
    private _name: string,
    private _isActive: boolean,
    private readonly _createdBy: string | null,
  ) {}

  static create(
    organizationId: string,
    departmentId: string,
    name: string,
    createdBy: string,
  ): Team {
    const team = new Team(null, organizationId, departmentId, '', true, createdBy);
    team.rename(name);
    return team;
  }

  static rehydrate(
    id: string,
    organizationId: string,
    departmentId: string,
    name: string,
    isActive: boolean,
  ): Team {
    return new Team(id, organizationId, departmentId, name, isActive, null);
  }

  get id(): string | null {
    return this._id;
  }
  get organizationId(): string {
    return this._organizationId;
  }
  get departmentId(): string {
    return this._departmentId;
  }
  get name(): string {
    return this._name;
  }
  get nameKey(): string {
    return nameKey(this._name);
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdBy(): string | null {
    return this._createdBy;
  }

  rename(name: string): void {
    this._name = orgUnitName(name, 'Team name');
  }

  deactivate(): void {
    this._isActive = false;
  }
}
