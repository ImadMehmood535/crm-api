import { ApiProperty } from '@nestjs/swagger';

import { UnitReadModel } from '@infrastructure/queries/abstraction/IInventoryQueries';

/** The frontend's `Unit`. */
export class UnitResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty({ example: 'A-101' }) number!: string;
  @ApiProperty({ enum: ['apartment', 'villa', 'townhouse', 'plot', 'shop', 'office'] })
  type!: string;
  @ApiProperty({ enum: ['available', 'reserved', 'sold', 'blocked'] }) status!: string;
  @ApiProperty({ nullable: true, type: Number }) bedrooms!: number | null;
  @ApiProperty({ nullable: true, type: Number }) bathrooms!: number | null;
  @ApiProperty({ nullable: true, type: Number }) areaSqm!: number | null;
  @ApiProperty({ nullable: true, type: Number }) floor!: number | null;
  @ApiProperty({ nullable: true, type: Number }) price!: number | null;
  @ApiProperty({ nullable: true, type: String }) notes!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(unit: UnitReadModel): UnitResponse {
    return Object.assign(new UnitResponse(), unit);
  }
}
