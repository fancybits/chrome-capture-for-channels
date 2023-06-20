## chrome-capture-for-channels

Capture video and audio from a Chrome tab using the [`chrome.tabCapture`](https://developer.chrome.com/docs/extensions/reference/tabCapture/) API. Built on [Puppeteer](https://pptr.dev/) and [puppeteer-stream](https://github.com/SamuelScheit/puppeteer-stream)

### setup

download the latest [release](https://github.com/fancybits/chrome-capture-for-channels/releases) for macOS or Windows

or run in docker:

```
docker run -d --name chrome-capture -p 5589:5589 fancybits/chrome-capture-for-channels
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
winget install -e --id OpenJS.NodeJS

git clone https://github.com/fancybits/chrome-capture-for-channels
cd chrome-capture-for-channels
npm install
node main.js
```

#### mac

```
brew install nodejs git

git clone https://github.com/fancybits/chrome-capture-for-channels
cd chrome-capture-for-channels
npm install
node main.js
```
