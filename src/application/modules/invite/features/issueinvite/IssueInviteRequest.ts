import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

import { SLUG_MESSAGE, SLUG_RULE } from '@application/common/SlugRule';

export class IssueInviteRequest {
  @ApiProperty({ example: 'founder@harbor.example.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Ali' })
  @IsString()
  @Length(1, 100, { message: 'First name is required.' })
  firstName!: string;

  @ApiProperty({ example: 'Raza' })
  @IsString()
  @Length(1, 100, { message: 'Last name is required.' })
  lastName!: string;

  @ApiProperty({ example: 'Harbor Homes' })
  @IsString()
  @Length(2, 120, { message: 'Company name must be 2-120 characters.' })
  organizationName!: string;

  @ApiProperty({ example: 'harbor-homes' })
  @IsString()
  @Length(2, 40, { message: 'Slug must be 2-40 characters.' })
  @Matches(SLUG_RULE, { message: SLUG_MESSAGE })
  slug!: string;
}
