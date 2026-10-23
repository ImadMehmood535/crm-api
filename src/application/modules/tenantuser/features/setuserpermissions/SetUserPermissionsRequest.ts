import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

/** The user's desired effective permissions; the server stores the difference from their roles. */
export class SetUserPermissionsRequest {
  @ApiProperty({ type: [String], example: ['projects.view', 'projects.edit'] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissions!: string[];
}
