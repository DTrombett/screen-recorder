import ffmpeg from "ffmpeg-static";
import type { ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { cwd, exit, stderr, stdin, stdout } from "node:process";
import { createInterface } from "./readline";

// TODO: probesize

// eslint-disable-next-line prefer-const
let child: ChildProcess | undefined;
const startController = new AbortController();
const stopKeys = [
	0x71, /* Ctrl+C */ 0x03, /* Ctrl+D */ 0x04, /* Space */ 0x20,
	/* Enter */ 0x0a,
];

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
	.question("fps: (60) ", { signal: startController.signal })
	.then((f) => parseInt(f) || 60)
	.catch(() => 60);
const quality = await rl
	.question("quality (1-31): (31) ", { signal: startController.signal })
	.then((q) => {
		const i = parseInt(q);

		return !i || i < 1 || i > 31 ? 1 : 32 - i;
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
	file,
]);

if (!child.stderr || !child.stdin) {
	console.log("Cannot initialize ffmpeg correctly.");
	exit(1);
}
child.stderr.pipe(stderr);
child.on("close", exit);
