import ffmpeg from "ffmpeg-static";
import type { ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { stat, unlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { cwd, exit, stderr, stdin, stdout } from "node:process";
import { createInterface } from "node:readline";

let child: ChildProcess | undefined;
let started = false;
const stopKeys = [0x71, /* Ctrl+C */ 0x03, /* Ctrl+D */ 0x04, /* Space */ 0x20];
const defaults = {
	fps: 30,
	videoQuality: 1,
	audioQuality: 1,
} as const;
const args: string[] = [];
const formatDate = (date: Date) =>
	`${date.getDate().toString().padStart(2, "0")}-${date
		.getMonth()
		.toString()
		.padStart(2, "0")}-${date.getFullYear()} ${date
		.getHours()
		.toString()
		.padStart(2, "0")}-${date.getMinutes().toString().padStart(2, "0")}-${date
		.getSeconds()
		.toString()
		.padStart(2, "0")}` as const;
const rl = createInterface({
	input: stdin,
	output: stdout,
	removeHistoryDuplicates: true,
	tabSize: 4,
});
const question = (query: string) =>
	new Promise<string>((resolve, reject) => {
		if (started) {
			reject(new Error("Aborted"));
			return;
		}
		rl.question(query, resolve);
		rl.on("close", () => {
			reject(new Error("Aborted"));
		});
	});

stdin.setRawMode(true);
stdin.resume();
stdin.on("data", (data) => {
	if (data[0] === 0x13 /* Ctrl+S */) {
		started = true;
		rl.close();
		stdin.setRawMode(true);
		stdin.resume();
	} else if (data[0] === 0x03 /* Ctrl+C */ && !child) exit(0);
	else if (stopKeys.includes(data[0]) && child) child.stdin!.write("q\n");
	else if ((data[0] === 0x79 /* y */ || data[0] === 0x59) /* Y */ && child)
		child.stdin!.write("y\n");
});

console.log(
	"This simple program will start a screen recording with custom settings using ffmpeg.\nYou can also just record the audio without any video.\n"
);
console.log(
	"By default the record will be saved in the /Videos/Captures or /Music folder of your home directory if it exists and to the current working directory otherwise.\nYou can change it by using standard path notation.\n"
);
console.log("Press ^C at any time to quit or ^S to start the recording.");

const [withVideo, withAudio] = await question("input (v/a): (va) ")
	.then((a) => {
		const n = a.toLowerCase();

		if (/^(v|a|va|av)$/.test(n)) return [n.includes("v"), n.includes("a")];
		throw new Error();
	})
	.catch(() => [true, true]);
let startDir = withVideo
	? join(homedir(), "Videos", "Captures")
	: join(homedir(), "Music");

await stat(startDir)
	.then((s) => {
		if (!s.isDirectory()) throw new Error();
	})
	.catch(() => {
		startDir = cwd();
	});
const file = await question(
	`file-entry: (<date>.${withVideo ? "mp4" : "mp3"}) `
)
	.then((entry) => {
		if (entry)
			return join(startDir, entry.replace(/<date>/g, formatDate(new Date())));
		throw new Error();
	})
	.catch(() =>
		join(startDir, `${formatDate(new Date())}.${withVideo ? "mp4" : "mp3"}`)
	);
const fps = withVideo
	? await question("fps-max (24-30): (30) ")
			.then((f) => {
				const n = parseInt(f);

				return !n || n < 24 || n > 30 ? defaults.fps : n;
			})
			.catch(() => defaults.fps)
	: defaults.fps;
const videoQuality = withVideo
	? await question("video-quality (1-31): (31) ")
			.then((q) => {
				const n = parseInt(q);

				return !n || n < 1 || n > 31 ? defaults.videoQuality : 32 - n;
			})
			.catch(() => defaults.videoQuality)
	: defaults.videoQuality;
const audioQuality = withAudio
	? await question("audio-quality (1-31): (31) ")
			.then((q) => {
				const n = parseInt(q);

				return !n || n < 1 || n > 31 ? defaults.audioQuality : 32 - n;
			})
			.catch(() => defaults.audioQuality)
	: defaults.audioQuality;
const tmpFilePath = join(
	tmpdir(),
	`${Date.now()}.${withVideo ? "avi" : "mp3"}`
);

if (withVideo)
	args.push(
		"-f",
		"gdigrab",
		"-thread_queue_size",
		"4096",
		"-framerate",
		`${fps}`,
		"-i",
		"desktop"
	);
if (withAudio)
	args.push(
		"-f",
		"dshow",
		"-thread_queue_size",
		"4096",
		"-i",
		"audio=Stereo Mix (Realtek(R) Audio)",
		"-q:a",
		`${audioQuality}`
	);
if (withVideo) args.push("-q:v", `${videoQuality}`);
args.push(tmpFilePath);
console.log(`\nffmpeg ${args.join(" ")}`);
child = execFile(ffmpeg, args);
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
