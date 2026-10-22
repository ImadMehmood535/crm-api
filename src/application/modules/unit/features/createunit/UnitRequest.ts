import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { UNIT_STATUSES, UNIT_TYPES } from '@domain/aggregates/UnitAggregate/Unit';

/** Optional unit fields shared by create and update (null clears). */
export class UnitFieldsRequest {
  @ApiPropertyOptional({ enum: UNIT_TYPES })
  @IsOptional()
  @IsIn(UNIT_TYPES, { message: `Type must be one of: ${UNIT_TYPES.join(', ')}.` })
  type?: string;

  @ApiPropertyOptional({ enum: UNIT_STATUSES })
  @IsOptional()
  @IsIn(UNIT_STATUSES, { message: `Status must be one of: ${UNIT_STATUSES.join(', ')}.` })
  status?: string;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 50 })
  @IsOptional()
  @IsInt({ message: 'Bedrooms must be a whole number between 0 and 50.' })
  @Min(0, { message: 'Bedrooms must be a whole number between 0 and 50.' })
  @Max(50, { message: 'Bedrooms must be a whole number between 0 and 50.' })
  bedrooms?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 50 })
  @IsOptional()
  @IsInt({ message: 'Bathrooms must be a whole number between 0 and 50.' })
  @Min(0, { message: 'Bathrooms must be a whole number between 0 and 50.' })
  @Max(50, { message: 'Bathrooms must be a whole number between 0 and 50.' })
  bathrooms?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: -5, maximum: 200 })
  @IsOptional()
  @IsInt({ message: 'Floor must be a whole number between -5 and 200.' })
  @Min(-5, { message: 'Floor must be a whole number between -5 and 200.' })
  @Max(200, { message: 'Floor must be a whole number between -5 and 200.' })
  floor?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 120.5 })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Area must be a number above 0 with at most 2 decimals.' },
  )
  @Min(0.01, { message: 'Area must be a number above 0 with at most 2 decimals.' })
  @Max(99_999_999.99, { message: 'Area must be at most 99,999,999.99.' })
  areaSqm?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 250000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must be a number with at most 2 decimals.' })
  @Min(0, { message: 'Price must be between 0 and 99,999,999,999.99.' })
  @Max(99_999_999_999.99, { message: 'Price must be between 0 and 99,999,999,999.99.' })
  price?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Notes must be at most 2000 characters.' })
  notes?: string | null;
}

export class CreateUnitRequest extends UnitFieldsRequest {
  @ApiProperty({ example: 'A-101', maxLength: 40 })
  @IsString()
  @Length(1, 40, { message: 'Unit number must be 1-40 characters.' })
  number!: string;
}

export class UpdateUnitRequest extends UnitFieldsRequest {
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @Length(1, 40, { message: 'Unit number must be 1-40 characters.' })
  number?: string;
}
