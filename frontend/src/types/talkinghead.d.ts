declare module "@met4citizen/talkinghead" {
  export class TalkingHead {
    constructor(node: HTMLElement, opt?: Record<string, unknown>);
    showAvatar(avatar: Record<string, unknown>, onprogress?: unknown): Promise<void>;
    setValue(mt: string, val: number, ms?: number | null): void;
    setFixedValue(mt: string, val: number | null, ms?: number | null): void;
    lookAtCamera(t?: number): void;
    setMood(s: string): void;
    start(): void;
    stop(): void;
    streamStop(): void;
  }
}
