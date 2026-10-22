import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { ValidationFailedError } from '@shared/errors/AppError';

import { createValidationPipe } from './createValidationPipe';

class Owner {
  @IsEmail()
  email!: string;
}

class Body {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateNested()
  @Type(() => Owner)
  superUser!: Owner;
}

describe('createValidationPipe', () => {
  const pipe = createValidationPipe();
  const run = (value: object): Promise<unknown> =>
    pipe.transform(value, { type: 'body', metatype: Body });

  it('should report every bad field, nested ones in dot notation', async () => {
    const error = (await run({ name: '', superUser: { email: 'nope' } }).catch(
      (e: unknown) => e,
    )) as ValidationFailedError;

    expect(error).toBeInstanceOf(ValidationFailedError);
    expect(error.details?.map((d) => d.field)).toEqual(['name', 'superUser.email']);
  });

  it('should reject a property the DTO does not declare', async () => {
    const error = (await run({ name: 'A', superUser: { email: 'a@b.co' }, extra: 1 }).catch(
      (e: unknown) => e,
    )) as ValidationFailedError;

    expect(error.details).toEqual([
      { field: 'extra', messages: ['property extra should not exist'] },
    ]);
  });
});
