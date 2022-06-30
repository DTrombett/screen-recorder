import ffmpeg from "ffmpeg-static";
import type { ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { cwd, exit, stderr, stdin, stdout } from "node:process";
import { createInterface } from "./readline";

// eslint-disable-next-line prefer-const
let child: ChildProcess | undefined;
const startController = new AbortController();
const stopKeys = [0x71, /* Ctrl+C */ 0x03, /* Ctrl+D */ 0x04, /* Space */ 0x20];

stdin.setRawMode(true);
stdin.on("data", (data) => {
	if (data[0] === 0x13 /* Ctrl+S */) startController.abort();
	else if (data[0] === 0x03 /* Ctrl+C */ && !child) exit(0);
	else if (stopKeys.includes(data[0]) && child) child.stdin!.write("q\n");
});

const rl = createInterface({
	input: stdin,
	output: stdout,
	history: ["60", "1", "1"],
	removeHistoryDuplicates: true,
	tabSize: 4,
});

console.log(
	"This simple program will start a screen recording with custom settings using ffmpeg.\n"
);
console.log("Press ^C at any time to quit or ^S to start the recording.");

const file = await rl
	.question("file-entry: (<date>.avi) ", { signal: startController.signal })
	.then((entry) => join(cwd(), entry || `${Date.now()}.avi`))
	.catch(() => `${Date.now()}.avi`);
const fps = await rl
	.question("fps-max (24-30): (30) ", { signal: startController.signal })
	.then((f) => {
		const n = parseInt(f);

		return !n || n < 24 || n > 30 ? 30 : n;
	})
	.catch(() => 30);
const quality = await rl
	.question("quality (1-31): (31) ", { signal: startController.signal })
	.then((q) => {
		const n = parseInt(q);

		return !n || n < 1 || n > 31 ? 1 : 32 - n;
	})
	.catch(() => 1);

child = execFile(ffmpeg, [
	"-f",
	"gdigrab",
	"-framerate",
	`${fps}`,
	"-i",
	"desktop",
	"-q:v",
	`${quality}`,
	"-qp",
	"0",
	file,
]);

if (!child.stderr || !child.stdin) {
	console.log("Cannot initialize ffmpeg correctly.");
	exit(1);
}
child.stderr.pipe(stderr);
child.on("close", exit);
