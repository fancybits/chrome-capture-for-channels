## chrome-capture-for-channels

Capture video and audio from a Chrome tab using the [`chrome.tabCapture`](https://developer.chrome.com/docs/extensions/reference/tabCapture/) API. Built on [Puppeteer](https://pptr.dev/) and [puppeteer-stream](https://github.com/SamuelScheit/puppeteer-stream)

### setup

See detailed installation/configuration instructions here:
[Chrome Capture Thread](https://community.getchannels.com/t/chrome-capture-for-channels/36667/130)

download the latest [release](https://github.com/fancybits/chrome-capture-for-channels/releases) for macOS or Windows

or run in docker:

```
docker run -d --name chrome-capture -p 5589:5589 fancybits/chrome-capture-for-channels
```

### usage

a http server is listening on port 5589 and responds to these routes. the response is a webm stream with h264 video and opus audio.

- `/stream/<name>` for stream names registered in the code
- `/stream?url=<url>` for other arbitrary URLs

URL support includes www.nbc.com, slingTV, and Google Photo album slideshow

setup a new Custom Channel using:

```
#EXTM3U
#EXTINF:-1 channel-id="weatherscan",Weatherscan
chrome://x.x.x.x:5589/stream?url=https://weatherscan.net

#EXTINF:-1 channel-id="Bravo (East)",Bravo (East)
chrome://x.x.x.x:5589/stream/bravo

#EXTINF:-1 channel-id="CC" tvg-chno="107" tvc-guide-stationid="62420", Comedy Central
chrome://x.x.x.x:5589/stream?url=https://watch.sling.com/1/channel/29938328f60d447299ec48511a09ebab/watch

#EXTINF:-1 channel-id=Google Album",Google Album
chrome://x.x.x.x:5589/stream?url=https://photos.app.goo.gl/<yoursharedlinkhere>

```

### command line
```
Usage: node main.js [options]

Options:
  -v, --videoBitrate  Video bitrate in bits per second  [number] [default: 6000000]
  -a, --audioBitrate  Audio bitrate in bits per second  [number] [default: 192000]
  -f, --frameRate     Minimum frame rate  [number] [default: 60]
  -h, --help          Show help  [boolean]

Examples:
  node main.js -v 6000000 -a 192000 -f 30             Capture at 6Mbps video, 192kbps audio, 30fps
  node main.js --videoBitrate 8000000 --frameRate 60  High quality capture at 8Mbps and 60fps
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
