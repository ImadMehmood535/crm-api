import { Injectable, PipeTransform } from '@nestjs/common';

import { NotFoundError } from '@shared/errors/AppError';
import { isUuid } from '@shared/utils/Uuid';

/** A malformed id is reported exactly like an unknown one: 404, so ids cannot be probed. */
@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isUuid(value)) throw new NotFoundError();
    return value.toLowerCase();
  }
}
