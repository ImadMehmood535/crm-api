import { oneOf, optionalText, requiredText } from '@shared/domain/Guards';
import { ValidationFailedError } from '@shared/errors/AppError';

import { nameKey } from './InventoryText';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const CITY_MAX_LENGTH = 100;
const ADDRESS_MAX_LENGTH = 300;
const CURRENCY = /^[A-Za-z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const PROJECT_STATUSES = ['planning', 'active', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectProps {
  organizationId: string;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  currency: string | null;
  status: string | null;
  expectedCompletion: string | null;
  createdBy: string | null;
}

/** A development owned by one company. */
export class Project {
  private constructor(
    private readonly _id: string | null,
    private readonly _organizationId: string,
    private _name: string,
    private _description: string | null,
    private _city: string | null,
    private _address: string | null,
    private _currency: string,
    private _status: ProjectStatus,
    private _expectedCompletion: string | null,
    private readonly _createdBy: string | null,
  ) {}

  static create(props: ProjectProps): Project {
    const project = new Project(
      null,
      props.organizationId,
      '',
      null,
      null,
      null,
      'USD',
      'planning',
      null,
      props.createdBy,
    );
    project.rename(props.name);
    project.describe(props.description);
    project.relocate(props.city, props.address);
    if (props.currency !== null) project.setCurrency(props.currency);
    if (props.status !== null) project.changeStatus(props.status);
    project.scheduleCompletion(props.expectedCompletion);
    return project;
  }

  static rehydrate(
    id: string,
    organizationId: string,
    name: string,
    description: string | null,
    city: string | null,
    address: string | null,
    currency: string,
    status: ProjectStatus,
    expectedCompletion: string | null,
  ): Project {
    return new Project(
      id,
      organizationId,
      name,
      description,
      city,
      address,
      currency,
      status,
      expectedCompletion,
      null,
    );
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
  get description(): string | null {
    return this._description;
  }
  get city(): string | null {
    return this._city;
  }
  get address(): string | null {
    return this._address;
  }
  get currency(): string {
    return this._currency;
  }
  get status(): ProjectStatus {
    return this._status;
  }
  get expectedCompletion(): string | null {
    return this._expectedCompletion;
  }
  get createdBy(): string | null {
    return this._createdBy;
  }

  rename(name: string): void {
    const trimmed = requiredText(name, 'name', 'Name', NAME_MAX_LENGTH);
    if (trimmed.length < NAME_MIN_LENGTH) {
      throw ValidationFailedError.forField(
        'name',
        `Name must be at least ${NAME_MIN_LENGTH} characters.`,
      );
    }
    this._name = trimmed;
  }

  describe(description: string | null): void {
    this._description = optionalText(
      description,
      'description',
      'Description',
      DESCRIPTION_MAX_LENGTH,
    );
  }

  relocate(city: string | null, address: string | null): void {
    this._city = optionalText(city, 'city', 'City', CITY_MAX_LENGTH);
    this._address = optionalText(address, 'address', 'Address', ADDRESS_MAX_LENGTH);
  }

  setCurrency(currency: string): void {
    if (!CURRENCY.test(currency.trim())) {
      throw ValidationFailedError.forField('currency', 'Currency must be a 3-letter code.');
    }
    this._currency = currency.trim().toUpperCase();
  }

  changeStatus(status: string): void {
    this._status = oneOf(status, PROJECT_STATUSES, 'status', 'Status');
  }

  scheduleCompletion(date: string | null): void {
    if (date !== null && (!DATE.test(date) || Number.isNaN(Date.parse(date)))) {
      throw ValidationFailedError.forField(
        'expectedCompletion',
        'Expected completion must be a valid date (YYYY-MM-DD).',
      );
    }
    this._expectedCompletion = date;
  }
}
