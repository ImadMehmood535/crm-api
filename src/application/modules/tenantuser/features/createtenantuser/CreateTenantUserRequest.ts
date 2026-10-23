import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

import { CREATABLE_LEVELS, UserLevel } from '@shared/auth/UserLevel';

export class CreateTenantUserRequest {
  @ApiProperty({ example: 'hira@skyline.example.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Hira' })
  @IsString()
  @Length(1, 100, { message: 'First name is required.' })
  firstName!: string;

  @ApiProperty({ example: 'Shah' })
  @IsString()
  @Length(1, 100, { message: 'Last name is required.' })
  lastName!: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Required for members; admins and department heads get their built-in role.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true, message: 'One or more roles do not exist.' })
  roleIds?: string[];

  @ApiPropertyOptional({ enum: CREATABLE_LEVELS, default: 'member' })
  @IsOptional()
  @IsIn(CREATABLE_LEVELS, { message: 'Choose a valid level.' })
  level?: UserLevel;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true, message: 'One or more teams cannot be used.' })
  teamIds?: string[];
}
