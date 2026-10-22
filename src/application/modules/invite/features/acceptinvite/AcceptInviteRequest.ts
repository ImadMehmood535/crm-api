import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class AcceptInviteRequest {
  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters.' })
  @MaxLength(128, { message: 'Password must be at most 128 characters.' })
  password!: string;

  @ApiPropertyOptional({ description: 'Defaults to the invited company name' })
  @IsOptional()
  @IsString()
  @Length(2, 120, { message: 'Company name must be 2-120 characters.' })
  organizationName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'First name is required.' })
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Last name is required.' })
  lastName?: string;
}
