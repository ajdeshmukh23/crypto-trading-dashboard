declare module 'jest-websocket-mock' {
  export default class WS {
    static clean(): void;
    constructor(url: string, options?: any);
    connected: Promise<WebSocket>;
    closed: Promise<{ wasClean: boolean; code: number; reason: string }>;
    error(): void;
    send(message: string | ArrayBuffer | Blob): void;
    close(options?: { wasClean?: boolean; code?: number; reason?: string }): void;
    messages: Array<string | ArrayBuffer | Blob>;
  }
}