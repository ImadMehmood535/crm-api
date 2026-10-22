import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class CreatePlatformAdminRequest {
  @ApiProperty({ example: 'ops@invespy.example.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Ana' })
  @IsString()
  @Length(1, 100, { message: 'First name is required.' })
  firstName!: string;

  @ApiProperty({ example: 'Lee' })
  @IsString()
  @Length(1, 100, { message: 'Last name is required.' })
  lastName!: string;
}
