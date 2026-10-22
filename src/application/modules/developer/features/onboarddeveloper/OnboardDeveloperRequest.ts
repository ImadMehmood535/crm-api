import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength, ValidateNested } from 'class-validator';

import { SLUG_MESSAGE, SLUG_RULE } from '@application/common/SlugRule';

export class OwnerRequest {
  @ApiProperty({ example: 'owner@palm.example.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Sara', maxLength: 100 })
  @IsString()
  @Length(1, 100, { message: 'First name is required.' })
  firstName!: string;

  @ApiProperty({ example: 'Khan', maxLength: 100 })
  @IsString()
  @Length(1, 100, { message: 'Last name is required.' })
  lastName!: string;
}

export class OnboardDeveloperRequest {
  @ApiProperty({ example: 'Palm Estates', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120, { message: 'Company name must be 2-120 characters.' })
  name!: string;

  @ApiProperty({ example: 'palm-estates', minLength: 2, maxLength: 40 })
  @IsString()
  @Length(2, 40, { message: 'Slug must be 2-40 characters.' })
  @Matches(SLUG_RULE, { message: SLUG_MESSAGE })
  slug!: string;

  @ApiProperty({ type: OwnerRequest })
  @ValidateNested()
  @Type(() => OwnerRequest)
  superUser!: OwnerRequest;
}
