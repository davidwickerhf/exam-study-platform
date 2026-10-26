export type Row = Record<string, any>
export interface PgQuery<T = Row> extends PromiseLike<T[]> {
  catch<R = never>(onrejected?: ((reason: any) => R | PromiseLike<R>) | null): Promise<T[] | R>
  finally(onfinally?: (() => void) | null): Promise<T[]>
}
export interface TransactionOptions { isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'; readOnly?: boolean; deferrable?: boolean }
export interface Sql {
  <T = Row>(strings: TemplateStringsArray, ...values: unknown[]): PgQuery<T>
  query<T = Row>(text: string, params?: unknown[]): PgQuery<T>
  transaction(queries: PgQuery<any>[] | ((sql: Sql) => PgQuery<any>[]), options?: TransactionOptions): Promise<Row[][]>
  pool: any
}
export function poolFor(connectionString: string, options?: { queryTimeoutMs?: number }): any
export function createSql(connectionString: string, options?: { queryTimeoutMs?: number }): Sql
