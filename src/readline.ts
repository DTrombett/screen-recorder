import type {
	createInterface as cInterface,
	ReadLineOptions,
} from "node:readline";
import { Interface } from "node:readline";
import type { Writable } from "node:stream";

const readlinePromises = "node:readline/promises";
const rlPromises = (await import(readlinePromises)) as {
	Interface: typeof PromisesInterface;
	Readline: typeof PromisesReadline;
	createInterface(...args: Parameters<typeof cInterface>): PromisesInterface;
};

declare class PromisesInterface extends Interface {
	// @ts-expect-error Override
	question(
		query: string,
		options?: {
			signal: AbortSignal;
		}
	): Promise<string>;
}
declare class PromisesReadline {
	constructor(stream: Writable, options?: { autoCommit: boolean });
	clearLine(dir: number): this;
	clearScreenDown(): this;
	commit(): Promise<void>;
	cursorTo(x: number, y?: number): this;
	moveCursor(dx: number, dy: number): this;
	rollback(): this;
}

export const createInterface = (options: ReadLineOptions) =>
	rlPromises.createInterface(options);
export default rlPromises;
