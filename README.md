## chrome-capture-for-channels

Capture video and audio from a Chrome tab using the [`chrome.tabCapture`](https://developer.chrome.com/docs/extensions/reference/tabCapture/) API. Built on [Puppeteer](https://pptr.dev/) and [puppeteer-stream](https://github.com/SamuelScheit/puppeteer-stream)

### setup

download the latest [release](https://github.com/fancybits/chrome-capture-for-channels/releases) for macOS or Windows

or run in docker:

```
docker run -d \
  --name cc4c \
  --shm-size=1g \
  -p 5589:5589 \
  -p 5900:5900 \
  -e HOST_VNC_PORT=5900 \
  -e VIDEO_BITRATE=9500000 \
  -e AUDIO_BITRATE=256000 \
  -e FRAMERATE=30 \
  -e CC4C_PORT=5589 \
  -e VIDEO_WIDTH=1920 \
  -e VIDEO_HEIGHT=1080 \
  -e VIDEO_CODEC=h264_vaapi \
  -e AUDIO_CODEC=aac \
  -e TZ=US/Mountain \
  -v cookies:/home/chrome/chromedata/Default/Cookies \
  -v logins:/home/chrome/chromedata/Default/Login\ Data \
  -v localstorage:/home/chrome/chromedata/Default/Local\ Storage \
  -v prefs:/home/chrome/chromedata/Default/Preferences \
  -v secure:/home/chrome/chromedata/Default/Secure\ Preferences \
  --restart unless-stopped \
  fancybits/chrome-capture-for-channels:latest
```

### usage

a http server is listening on port 5589 and responds to these routes. the response is a webm stream with h264 video and opus audio.

- `/stream/<name>` for stream names registered in the code
- `/stream?url=<url>` for other arbitrary URLs

setup a new Custom Channel using:

```
#EXTM3U
#EXTINF:-1 channel-id="weatherscan",Weatherscan
chrome://x.x.x.x:5589/stream?url=https://weatherscan.net
```

### development

to setup a development environment where you can edit and run `main.js`:

#### windows

```
winget install -e --id Git.Git
winget install -e --id Oven-sh.Bun

git clone https://github.com/fancybits/chrome-capture-for-channels
cd chrome-capture-for-channels
bun install
bun main.js
```

#### mac

```
brew install git
brew install oven-sh/bun/bun

git clone https://github.com/fancybits/chrome-capture-for-channels
cd chrome-capture-for-channels
bun install
bun main.js
```
