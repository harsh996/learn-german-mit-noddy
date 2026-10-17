declare module "@met4citizen/talkinghead" {
  export class TalkingHead {
    constructor(node: HTMLElement, opt?: Record<string, unknown>);
    showAvatar(avatar: Record<string, unknown>, onprogress?: unknown): Promise<void>;
    setValue(mt: string, val: number, ms?: number | null): void;
    setFixedValue(mt: string, val: number | null, ms?: number | null): void;
    lookAtCamera(t?: number): void;
    setView(view: string, opt?: Record<string, unknown>): void;
    setMood(s: string): void;
    start(): void;
    stop(): void;
    streamStop(): void;
    speakWithHands(): void;
    audioCtx: AudioContext;
    mtAvatar: Record<string, Record<string, unknown>>;
    opt: Record<string, unknown>;
    isSpeaking: boolean;
  }
}

declare module "@met4citizen/headaudio/dist/headaudio.min.mjs" {
  export class HeadAudio extends AudioWorkletNode {
    constructor(audioCtx: AudioContext, options?: Record<string, unknown>);
    loadModel(url: string, reset?: boolean): Promise<void>;
    update(dt: number): void;
    start(): void;
    stop(): void;
    onvalue: ((key: string, value: number) => void) | null;
    onstarted: ((data: unknown) => void) | null;
    onended: ((data: unknown) => void) | null;
  }
}
