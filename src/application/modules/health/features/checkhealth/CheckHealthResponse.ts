import { ApiProperty } from '@nestjs/swagger';

export class CheckHealthResponse {
  @ApiProperty({ enum: ['ok', 'error'], example: 'ok' })
  status!: 'ok' | 'error';

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  db!: 'up' | 'down';

  static of(dbUp: boolean): CheckHealthResponse {
    const response = new CheckHealthResponse();
    response.status = dbUp ? 'ok' : 'error';
    response.db = dbUp ? 'up' : 'down';
    return response;
  }
}
