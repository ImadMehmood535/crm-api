import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE = 'rawResponse';

/** Opts a handler out of the `{ success, data }` envelope (health probe, binary files). */
export const RawResponse = (): MethodDecorator & ClassDecorator => SetMetadata(RAW_RESPONSE, true);
