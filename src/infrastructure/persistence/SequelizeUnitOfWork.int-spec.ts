import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { SequelizeUnitOfWork } from './SequelizeUnitOfWork';

describe('SequelizeUnitOfWork', () => {
  let sequelize: Sequelize;
  let unitOfWork: SequelizeUnitOfWork;

  beforeAll(async () => {
    sequelize = new Sequelize(process.env.DATABASE_URL ?? '', { logging: false });
    await sequelize.query('CREATE TABLE IF NOT EXISTS zz_uow (n int)');
    unitOfWork = new SequelizeUnitOfWork(sequelize);
  });

  beforeEach(() => sequelize.query('TRUNCATE zz_uow'));

  afterAll(async () => {
    await sequelize.query('DROP TABLE IF EXISTS zz_uow');
    await sequelize.close();
  });

  const insert = (n: number, tx: object): Promise<unknown> =>
    sequelize.query('INSERT INTO zz_uow (n) VALUES (:n)', {
      replacements: { n },
      transaction: tx as Transaction,
    });
  const count = async (): Promise<number> => {
    const rows = await sequelize.query<{ c: string }>('SELECT count(*) AS c FROM zz_uow', {
      type: QueryTypes.SELECT,
    });
    return Number(rows[0].c);
  };

  it('should commit every write when the work resolves', async () => {
    const result = await unitOfWork.run(async (tx) => {
      await insert(1, tx);
      await insert(2, tx);
      return 'done';
    });

    expect(result).toBe('done');
    expect(await count()).toBe(2);
  });

  it('should roll back every write when the work throws', async () => {
    const act = unitOfWork.run(async (tx) => {
      await insert(1, tx);
      throw new Error('boom');
    });

    await expect(act).rejects.toThrow('boom');
    expect(await count()).toBe(0);
  });
});
