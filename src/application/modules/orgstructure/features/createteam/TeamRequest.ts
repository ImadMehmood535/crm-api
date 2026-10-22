import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

const NAME_MESSAGE = 'Name must be 2-100 characters.';

export class CreateTeamRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Choose a department.' })
  departmentId!: string;

  @ApiProperty({ example: 'Payables', minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100, { message: NAME_MESSAGE })
  name!: string;
}

export class UpdateTeamRequest {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(2, 100, { message: NAME_MESSAGE })
  name?: string;
}

export class AddTeamMemberRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Choose an active user you manage.' })
  userId!: string;
}
