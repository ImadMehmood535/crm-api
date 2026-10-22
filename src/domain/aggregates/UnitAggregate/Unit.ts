import { oneOf, optionalText, requiredText } from '@shared/domain/Guards';
import { ValidationFailedError } from '@shared/errors/AppError';

import { nameKey, naturalSortKey } from '../ProjectAggregate/InventoryText';

const NUMBER_MAX_LENGTH = 40;
const NOTES_MAX_LENGTH = 2000;
const MAX_ROOMS = 50;
const MIN_FLOOR = -5;
const MAX_FLOOR = 200;
const MAX_AREA = 99_999_999.99;
const MAX_PRICE = 99_999_999_999.99;
export const UNIT_TYPES = ['apartment', 'villa', 'townhouse', 'plot', 'shop', 'office'] as const;
export const UNIT_STATUSES = ['available', 'reserved', 'sold', 'blocked'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];
export type UnitStatus = (typeof UNIT_STATUSES)[number];

const hasAtMostTwoDecimals = (value: number): boolean =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

function wholeNumber(
  value: number | null,
  field: string,
  label: string,
  min: number,
  max: number,
): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw ValidationFailedError.forField(
      field,
      `${label} must be a whole number between ${min} and ${max}.`,
    );
  }
  return value;
}

function money(
  value: number | null,
  field: string,
  label: string,
  min: number,
  max: number,
  exclusiveMin: boolean,
): number | null {
  if (value === null) return null;
  const tooLow = exclusiveMin ? value <= min : value < min;
  if (!Number.isFinite(value) || tooLow || value > max || !hasAtMostTwoDecimals(value)) {
    throw ValidationFailedError.forField(
      field,
      `${label} must be a number ${exclusiveMin ? 'above' : 'from'} ${min} up to ${max} with at most 2 decimals.`,
    );
  }
  return value;
}

export interface UnitProps {
  organizationId: string;
  projectId: string;
  number: string;
  type: string | null;
  status: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  areaSqm: number | null;
  price: number | null;
  notes: string | null;
  createdBy: string | null;
}

/** A sellable unit inside one project. It never moves to another project. */
export class Unit {
  private constructor(
    private readonly _id: string | null,
    private readonly _organizationId: string,
    private readonly _projectId: string,
    private _number: string,
    private _type: UnitType,
    private _status: UnitStatus,
    private _bedrooms: number | null,
    private _bathrooms: number | null,
    private _floor: number | null,
    private _areaSqm: number | null,
    private _price: number | null,
    private _notes: string | null,
    private readonly _createdBy: string | null,
  ) {}

  static create(props: UnitProps): Unit {
    const unit = new Unit(
      null,
      props.organizationId,
      props.projectId,
      '',
      'apartment',
      'available',
      null,
      null,
      null,
      null,
      null,
      null,
      props.createdBy,
    );
    unit.renumber(props.number);
    if (props.type !== null) unit.changeType(props.type);
    if (props.status !== null) unit.changeStatus(props.status);
    unit.setLayout(props.bedrooms, props.bathrooms, props.floor);
    unit.setArea(props.areaSqm);
    unit.setPrice(props.price);
    unit.annotate(props.notes);
    return unit;
  }

  static rehydrate(
    id: string,
    organizationId: string,
    projectId: string,
    number: string,
    type: UnitType,
    status: UnitStatus,
    bedrooms: number | null,
    bathrooms: number | null,
    floor: number | null,
    areaSqm: number | null,
    price: number | null,
    notes: string | null,
  ): Unit {
    return new Unit(
      id,
      organizationId,
      projectId,
      number,
      type,
      status,
      bedrooms,
      bathrooms,
      floor,
      areaSqm,
      price,
      notes,
      null,
    );
  }

  get id(): string | null {
    return this._id;
  }
  get organizationId(): string {
    return this._organizationId;
  }
  get projectId(): string {
    return this._projectId;
  }
  get number(): string {
    return this._number;
  }
  get numberKey(): string {
    return nameKey(this._number);
  }
  get numberSort(): string {
    return naturalSortKey(this._number);
  }
  get type(): UnitType {
    return this._type;
  }
  get status(): UnitStatus {
    return this._status;
  }
  get bedrooms(): number | null {
    return this._bedrooms;
  }
  get bathrooms(): number | null {
    return this._bathrooms;
  }
  get floor(): number | null {
    return this._floor;
  }
  get areaSqm(): number | null {
    return this._areaSqm;
  }
  get price(): number | null {
    return this._price;
  }
  get notes(): string | null {
    return this._notes;
  }
  get createdBy(): string | null {
    return this._createdBy;
  }

  renumber(number: string): void {
    this._number = requiredText(number, 'number', 'Unit number', NUMBER_MAX_LENGTH);
  }

  changeType(type: string): void {
    this._type = oneOf(type, UNIT_TYPES, 'type', 'Type');
  }

  changeStatus(status: string): void {
    this._status = oneOf(status, UNIT_STATUSES, 'status', 'Status');
  }

  setLayout(bedrooms: number | null, bathrooms: number | null, floor: number | null): void {
    this._bedrooms = wholeNumber(bedrooms, 'bedrooms', 'Bedrooms', 0, MAX_ROOMS);
    this._bathrooms = wholeNumber(bathrooms, 'bathrooms', 'Bathrooms', 0, MAX_ROOMS);
    this._floor = wholeNumber(floor, 'floor', 'Floor', MIN_FLOOR, MAX_FLOOR);
  }

  setArea(areaSqm: number | null): void {
    this._areaSqm = money(areaSqm, 'areaSqm', 'Area', 0, MAX_AREA, true);
  }

  setPrice(price: number | null): void {
    this._price = money(price, 'price', 'Price', 0, MAX_PRICE, false);
  }

  annotate(notes: string | null): void {
    this._notes = optionalText(notes, 'notes', 'Notes', NOTES_MAX_LENGTH);
  }
}
