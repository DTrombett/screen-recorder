import ffmpeg from "ffmpeg-static";
import { execFile } from "node:child_process";
import { stderr, stdin } from "node:process";

const child = execFile(
	ffmpeg,
	`-f gdigrab -framerate 60 -i desktop -q:v 1 -q:a 1 captures/${Date.now()}.avi`.split(
		" "
	)
);

child.stderr?.pipe(stderr);
if (child.stdin) stdin.pipe(child.stdin);
