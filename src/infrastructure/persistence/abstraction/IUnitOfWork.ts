/** An open database transaction. Opaque on purpose: application code never sees Sequelize. */
export type Tx = object;

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface IUnitOfWork {
  /** Runs `work` in one transaction: commits when it resolves, rolls back when it throws. */
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}
