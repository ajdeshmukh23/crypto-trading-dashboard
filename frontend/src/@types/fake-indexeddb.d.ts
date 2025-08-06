declare module 'fake-indexeddb/lib/FDBFactory' {
  export default class FDBFactory implements IDBFactory {
    open(name: string, version?: number): IDBOpenDBRequest;
    deleteDatabase(name: string): IDBOpenDBRequest;
    cmp(first: any, second: any): number;
    databases(): Promise<IDBDatabaseInfo[]>;
  }
}

declare module 'fake-indexeddb/lib/FDBKeyRange' {
  const FDBKeyRange: typeof IDBKeyRange;
  export default FDBKeyRange;
}