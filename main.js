const { launch, getStream } = require("puppeteer-stream");
const fs = require("fs");
const child_process = require("child_process");
const process = require("process");
const path = require("path");

const viewport = {
	width: 1920,
	height: 1080,
};

const getExecutablePath = () => {
	if (process.env.CHROME_BIN) {
	  return process.env.CHROME_BIN;
	}
  
	let executablePath;
	if (process.platform === 'linux') {
	  try {
		executablePath = child_process.execSync('which chromium-browser').toString().split('\n').shift();
	  } catch (e) {
		// NOOP
	  }
  
	  if (!executablePath) {
		executablePath = child_process.execSync('which chromium').toString().split('\n').shift();
		if (!executablePath) {
		  throw new Error('Chromium not found (which chromium)');
		}
	  }
	} else if (process.platform === 'darwin') {
	  executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
	} else if (process.platform === 'win32') {
	  executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
	} else {
	  throw new Error('Unsupported platform: ' + process.platform);
	}
  
	return executablePath;
  };

async function main() {
	const browser = await launch({
		executablePath: getExecutablePath(),
		defaultViewport: null, // no viewport emulation
		args: [
			"--disable-notifications",
			"--no-first-run",
			"--disable-infobars",
			"--hide-crash-restore-bubble",
			`--user-data-dir=${path.join(process.cwd(), "chromedata")}`,
		],
		ignoreDefaultArgs: ["--enable-automation", "--disable-component-update"],
	});

	const page = await browser.newPage();
	const stream = await getStream(page, {
		audio: true,
		video: true,
		frameSize: 1000,
		audioBitsPerSecond: 128000,
		videoBitsPerSecond: 5000000,
		mimeType: "video/webm;codecs=H264",
		videoConstraints: {
			mandatory: {
				minWidth: viewport.width,
				minHeight: viewport.height,
				maxWidth: viewport.width,
				maxHeight: viewport.height,
				minFrameRate: 60,
			},
		},
	});
	// this will pipe the stream to ffmpeg and convert the webm to mkv format (which supports vp8/vp9)
	const ffmpeg = child_process.exec(`ffmpeg -y -i - -c copy output.mkv`);
	ffmpeg.stderr.on("data", (chunk) => {
		console.log(chunk.toString());
	});
	stream.pipe(ffmpeg.stdin);

	//await page.goto("https://www.nbc.com/live?brand=nbc-news&callsign=nbcnews");
	await page.goto("https://www.nbc.com/live?brand=cnbc&callsign=cnbc");
	await page.waitForSelector("video");
	await page.waitForFunction(() => {
		let video = document.querySelector("video");
		return video.readyState === 4;
	});
	await page.evaluate(() => {
		let video = document.querySelector("video");
		//video.requestFullscreen();
		//document.querySelector("button[data-name=fullscreen]").click();
		video.style.position = "fixed";
		video.style.top = "0";
		video.style.left = "0";
		video.style.width = "100%";
		video.style.height = "100%";
		video.style.zIndex = "999000";
		video.style.background = "black";
		video.style.cursor = "none";
		video.play();
	});

	const session = await page.target().createCDPSession();
	const { windowId } = await session.send("Browser.getWindowForTarget");
	await session.send("Browser.setWindowBounds", {
		windowId,
		bounds: {
			height: viewport.height + 77,
			width: viewport.width,
		},
	});
	await session.send("Browser.setWindowBounds", {
		windowId,
		bounds: {
			windowState: "minimized",
		},
	});

	process.on("SIGINT", async () => {
		await stream.destroy();
		ffmpeg.kill("SIGINT");

		console.log("finished");
	});
}

main();