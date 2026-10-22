import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

import { PROJECT_STATUSES } from '@domain/aggregates/ProjectAggregate/Project';

/** Optional project fields shared by create and update (null clears). */
export class ProjectFieldsRequest {
  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Description must be at most 2000 characters.' })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'City must be at most 100 characters.' })
  city?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Address must be at most 300 characters.' })
  address?: string | null;

  @ApiPropertyOptional({ example: 'USD', description: 'ISO-4217 code' })
  @IsOptional()
  @Matches(/^[A-Za-z]{3}$/, { message: 'Currency must be a 3-letter code.' })
  currency?: string;

  @ApiPropertyOptional({ enum: PROJECT_STATUSES })
  @IsOptional()
  @IsIn(PROJECT_STATUSES, { message: `Status must be one of: ${PROJECT_STATUSES.join(', ')}.` })
  status?: string;

  @ApiPropertyOptional({ nullable: true, example: '2027-06-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Expected completion must be a valid date (YYYY-MM-DD).',
  })
  expectedCompletion?: string | null;
}

export class CreateProjectRequest extends ProjectFieldsRequest {
  @ApiProperty({ example: 'Palm Heights', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120, { message: 'Name must be 2-120 characters.' })
  name!: string;
}

export class UpdateProjectRequest extends ProjectFieldsRequest {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(2, 120, { message: 'Name must be 2-120 characters.' })
  name?: string;
}
