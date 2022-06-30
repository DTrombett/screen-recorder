import ffmpeg from "ffmpeg-static";
import type { ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cwd, exit, stderr, stdin, stdout } from "node:process";
import { createInterface } from "./readline";

// eslint-disable-next-line prefer-const
let child: ChildProcess | undefined;
const startController = new AbortController();
const stopKeys = [0x71, /* Ctrl+C */ 0x03, /* Ctrl+D */ 0x04, /* Space */ 0x20];
const defaults = {
	fps: 30,
	videoQuality: 1,
	audioQuality: 1,
};

stdin.setRawMode(true);
stdin.on("data", (data) => {
	if (data[0] === 0x13 /* Ctrl+S */) startController.abort();
	else if (data[0] === 0x03 /* Ctrl+C */ && !child) exit(0);
	else if (stopKeys.includes(data[0]) && child) child.stdin!.write("q\n");
	else if ((data[0] === 0x79 /* y */ || data[0] === 0x59) /* Y */ && child)
		child.stdin!.write("y\n");
});

const rl = createInterface({
	input: stdin,
	output: stdout,
	history: ["30"],
	removeHistoryDuplicates: true,
	tabSize: 4,
});

console.log(
	"This simple program will start a screen recording with custom settings using ffmpeg.\n"
);
console.log("Press ^C at any time to quit or ^S to start the recording.");

const file = await rl
	.question("file-entry: (<date>.mp4) ", { signal: startController.signal })
	.then((entry) => join(cwd(), entry || `${Date.now()}.mp4`))
	.catch(() => `${Date.now()}.mp4`);
const fps = await rl
	.question("fps-max (24-30): (30) ", { signal: startController.signal })
	.then((f) => {
		const n = parseInt(f);

		return !n || n < 24 || n > 30 ? defaults.fps : n;
	})
	.catch(() => defaults.fps);
const videoQuality = await rl
	.question("video-quality (1-31): (31) ", { signal: startController.signal })
	.then((q) => {
		const n = parseInt(q);

		return !n || n < 1 || n > 31 ? defaults.videoQuality : 32 - n;
	})
	.catch(() => defaults.videoQuality);
const withAudio = await rl
	.question("with-audio (y/n): (y) ", { signal: startController.signal })
	.then((a) => {
		const n = a.toLowerCase();

		return !n || n === "y" || n === "yes";
	})
	.catch(() => true);
const audioQuality = withAudio
	? await rl
			.question("audio-quality (1-31): (31) ", {
				signal: startController.signal,
			})
			.then((q) => {
				const n = parseInt(q);

				return !n || n < 1 || n > 31 ? defaults.audioQuality : 32 - n;
			})
			.catch(() => defaults.audioQuality)
	: 0;
const tmpFilePath = join(tmpdir(), `${Date.now()}.avi`);

child = execFile(ffmpeg, [
	"-f",
	"gdigrab",
	"-thread_queue_size",
	"4096",
	"-framerate",
	`${fps}`,
	"-i",
	"desktop",
	"-q:v",
	`${videoQuality}`,
	"-qp",
	"0",
	tmpFilePath,
	...(withAudio
		? [
				"-f",
				"dshow",
				"-thread_queue_size",
				"4096",
				"-i",
				"audio=Stereo Mix (Realtek(R) Audio)",
				"-q:a",
				`${audioQuality}`,
				"-qp",
				"0",
				"-pix_fmt",
				"gbrapf32be",
		  ]
		: []),
]);

if (!child.stderr || !child.stdin) {
	console.error("Cannot initialize ffmpeg correctly.");
	exit(1);
}
child.stderr.pipe(stderr);
child.once("close", (code) => {
	if (code !== 0) exit(code ?? 1);
	child = execFile(ffmpeg, [
		"-i",
		tmpFilePath,
		"-c:v",
		"copy",
		"-c:a",
		"copy",
		"-y",
		file,
	]);

	child.stderr?.pipe(stderr);
	child.once("close", (c) => {
		unlink(tmpFilePath).finally(() => exit(c ?? 1));
	});
});
