import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginRequest {
  @ApiProperty({ example: 'platform@example.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'DemoPassword-Platform-1!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
