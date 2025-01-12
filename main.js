const {launch: puppeteerLaunch} = require('puppeteer-core')
const {launch, getStream} = require('puppeteer-stream')
const fs = require('fs')
const child_process = require('child_process')
const process = require('process')
const path = require('path')
const express = require('express')
const morgan = require('morgan')
require('express-async-errors')
require('console-stamp')(console, {
  format: ':date(yyyy/mm/dd HH:MM:ss.l)',
})

// Parse command line arguments
const argv = require('yargs')
  .option('videoBitrate', {
    alias: 'v',
    description: 'Video bitrate in bits per second',
    type: 'number',
    default: 6000000
  })
  .option('audioBitrate', {
    alias: 'a',
    description: 'Audio bitrate in bits per second',
    type: 'number',
    default: 256000
  })
  .option('frameRate', {
    alias: 'f',
    description: 'Minimum frame rate',
    type: 'number',
    default: 30
  })
  .option('port', {
    alias: 'p',
    description: 'Port number for the server',
    type: 'number',
    default: 5589
  })
  .option('width', {
    alias: 'w',
    description: 'Video width in pixels (e.g., 1920 for 1080p)',
    type: 'number',
    default: 1920,
  })
  .option('height', {
    alias: 'h', 
    description: 'Video height in pixels (e.g., 1080 for 1080p)',
    type: 'number',
    default: 1080,
  })
  .option('videoCodec', {
    alias: 'i', 
    description: 'Video codec (e.g., h264_nvenc, h264_qsv, h264_amf, h264_vaapi)',
    type: 'string',
    default: 'h264_nvenc',
  })
  .option('audioCodec', {
    alias: 'u', 
    description: 'Audio codec (e.g., aac, opus)',
    type: 'string',
    default: 'aac',
  })
  .usage('Usage: $0 [options]')
  .example('$0 -v 6000000 -a 192000 -f 30 -w 1920 -h 1080', 'Capture at 6Mbps video, 192kbps audio, 30fps, 1920x1080')
  .example('$0 --videoBitrate 8000000 --audioBitrate 320000 --frameRate 60 --width 1920 --height 1080', 'High quality capture at 8Mbps and 60fpsm 1920x1080')
  .wrap(null)  // Don't wrap help text
  .help()
  .alias('help', '?')
  .version(false)  // Disable version number in help
  .argv;

// Display settings
console.log('Selected settings:');
console.log(`Video Bitrate: ${argv.videoBitrate} bps (${argv.videoBitrate/1000000}Mbps)`);
console.log(`Audio Bitrate: ${argv.audioBitrate} bps (${argv.audioBitrate/1000}kbps)`);
console.log(`Minimum Frame Rate: ${argv.frameRate} fps`);
console.log(`Port: ${argv.port}`);
console.log(`Resolution: ${argv.width}x${argv.height}`);
console.log(`Video Codec: ${argv.videoCodec}`);
console.log(`Audio Codec: ${argv.audioCodec}`);
  
const encodingParams = {
  videoBitsPerSecond: argv.videoBitrate,
  audioBitsPerSecond: argv.audioBitrate,
  videoCodec: argv.videoCodec, // Use NVENC for video encoding
  audioCodec: argv.audioCodec, // Use AAC for audio encoding
  minFrameRate: argv.frameRate,
  maxFrameRate: 60,
  mimeType: 'video/webm;codecs=H264',
}

const viewport = {
  width: argv.width,
  height: argv.height,
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

var currentBrowser, dataDir, lastPage
const getCurrentBrowser = async () => {
  if (!currentBrowser || !currentBrowser.isConnected()) {
    currentBrowser = await launch(
      {
        launch: opts => {
          if (process.pkg) {
            opts.args = opts.args.filter(
              arg => !arg.startsWith('--load-extension=') && !arg.startsWith('--disable-extensions-except=')
            )
            opts.args = opts.args.concat([
              `--load-extension=${path.join(dataDir, 'extension')}`,
              `--disable-extensions-except=${path.join(dataDir, 'extension')}`,
            ])
          }
          if (process.platform == 'win32') {
            opts.args = opts.args.concat([
              '--use-gl=angle',
              '--use-angle=d3d11on12'
            ])
          }
          if (process.env.DOCKER) {
            opts.args = opts.args.concat([
              '--use-gl=angle',
              '--use-angle=gl-egl',
              '--enable-features=VaapiVideoDecoder,VaapiVideoEncoder',
              '--ignore-gpu-blocklist',
              '--enable-zero-copy',
              '--enable-drdc',
              '--no-sandbox'
            ])
          }
          console.log("Launching Browser, Opts", opts);
          return puppeteerLaunch(opts)
        },
      },
      {
        executablePath: getExecutablePath(),
        pipe: true, // more robust to keep browser connection from disconnecting
        defaultViewport: null, // no viewport emulation
        userDataDir: path.join(dataDir, 'chromedata'),
        args: [
          '--no-first-run', // Skip first run wizards
          '--disable-infobars',
          '--hide-crash-restore-bubble',
          '--allow-running-insecure-content',  // Sling has both https and http
          '--autoplay-policy=no-user-gesture-required',
          '--log-level=2', // error level only
          '--disable-blink-features=AutomationControlled', // mitigates bot detection
          '--hide-scrollbars', // Hide scrollbars on captured pages
          '--hide-crash-restore-bubble', // Hide the yellow notification bar
          '--window-size='+viewport.width+','+viewport.height, // Set viewport resolution
          '--disable-notifications', // Mimic real user behavior
          '--enable-accelerated-video-decode',
          '--enable-accelerated-video-encode', 
          '--enable-features=UseSurfaceLayerForVideoCapture',
          '--enable-gpu-rasterization', 
          '--enable-oop-rasterization',
          '--disable-gpu-vsync',
          '--enable-audio-output', // Ensure audio output is enabled
        ],
        ignoreDefaultArgs: [
          '--enable-automation',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-component-update',
          '--disable-component-extensions-with-background-pages',
          '--enable-blink-features=IdleDetection',
        ],
      }
    )

    currentBrowser.on('close', () => {
      currentBrowser = null;
      console.log('Browser closed');
    })

    currentBrowser.on('targetcreated', (target) => {
      console.log('New target page created:', target.url());
    });
    
    currentBrowser.on('targetchanged', (target) => {
      console.log('Target page changed:', target.url());
    });
    
    currentBrowser.on('targetdestroyed', (target) => {
      console.log('Browser page closed:', target.url());
    });
  
    currentBrowser.on('disconnected', () => {
      console.log('Browser disconnected');
    });

  }

  return currentBrowser
}

const getExecutablePath = () => {
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN
  }

  let executablePath
  if (process.platform === 'linux') {
    try {
      executablePath = child_process.execSync('which chromium-browser').toString().split('\n').shift()
    } catch (e) {
      // NOOP
    }

    if (!executablePath) {
      executablePath = child_process.execSync('which chromium').toString().split('\n').shift()
      if (!executablePath) {
        throw new Error('Chromium not found (which chromium)')
      }
    }
  } else if (process.platform === 'darwin') {
    executablePath = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ].find(fs.existsSync)
  } else if (process.platform === 'win32') {
    executablePath = [
      `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`,
      `C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe`,
      path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Chromium', 'Application', 'chrome.exe'),
    ].find(fs.existsSync)
  } else {
    throw new Error('Unsupported platform: ' + process.platform)
  }

  return executablePath
}

async function main() {
  dataDir = process.cwd();
  if (process.pkg) {
    switch (process.platform) {
      case 'darwin':
        dataDir = path.join(process.env.HOME, 'Library', 'Application Support', 'ChromeCapture');
        break;
      case 'win32':
        dataDir = path.join(process.env.USERPROFILE, 'AppData', 'Local', 'ChromeCapture');
        break;
    }
    let out = path.join(dataDir, 'extension');
    fs.mkdirSync(out, {recursive: true});
    ['manifest.json', 'tsconfig.json', 'options.html', 'options.js'].forEach(file => {
      fs.copyFileSync(
        path.join(process.pkg.entrypoint, '..', 'node_modules', 'puppeteer-stream', 'extension', file),
        path.join(out, file)
      );
    });
  }

  const app = express();

  const df = require('dateformat');
  morgan.token('mydate', function (req) {
    return df(new Date(), 'yyyy/mm/dd HH:MM:ss.l')
  })
  app.use(morgan('[:mydate] :method :url from :remote-addr responded :status in :response-time ms'))

  app.get('/', (req, res) => {
    res.send(
      `<html>
  <title>Chrome Capture for Channels</title>
  <h2>Chrome Capture for Channels</h2>
  <p>Usage: <code>/stream?url=URL</code> or <code>/stream/&lt;name></code></p>
  <pre>
  #EXTM3U

  #EXTINF:-1 channel-id="windy",Windy
  chrome://${req.get('host')}/stream/windy

  #EXTINF:-1 channel-id="weatherscan",Weatherscan
  chrome://${req.get('host')}/stream/weatherscan
  </pre>
  </html>`
    )
  })

  app.get('/debug', async (req, res) => {
    res.send(`<html>
    <script>
    async function videoClick(e) {
      e.target.focus()
      let x = ((e.clientX-e.target.offsetLeft) * e.target.videoWidth)/e.target.clientWidth
      let y = ((e.clientY-e.target.offsetTop) * e.target.videoHeight)/e.target.clientHeight
      console.log('video click', x, y)
      await fetch('/debug/click/'+x+'/'+y)
    }
    async function videoKeyPress(e) {
      console.log('video keypress', e.key)
      await fetch('/debug/keypress/'+e.key)
    }
    document.addEventListener('keypress', videoKeyPress)
    </script>
    <video style="width: 100%; height: 100%" onKeyPress="videoKeyPress(event)" onClick="videoClick(event)" src="/stream?waitForVideo=false&url=${encodeURIComponent(
      req.query.url || 'https://google.com'
    )}" autoplay muted />
    </html>`)
  })

  app.get('/debug/click/:x/:y', async (req, res) => {
    let browser = await getCurrentBrowser()
    let pages = await browser.pages()
    if (pages.length == 0) {
      res.send('false')
      return
    }
    let page = pages[pages.length - 1]
    await page.mouse.click(parseInt(req.params.x), parseInt(req.params.y))
    res.send('true')
  })

  app.get('/debug/keypress/:key', async (req, res) => {
    let browser = await getCurrentBrowser()
    let pages = await browser.pages()
    if (pages.length == 0) {
      res.send('false')
      return
    }
    let page = pages[pages.length - 1]
    await page.keyboard.press(req.params.key)
    res.send('true')
  })

  app.get('/stream/:name?', async (req, res) => {
    var u = req.query.url

    let name = req.params.name
    if (name) {
      u = {
        nbc: 'https://www.nbc.com/live?brand=nbc&callsign=nbc',
        cnbc: 'https://www.nbc.com/live?brand=cnbc&callsign=cnbc',
        msnbc: 'https://www.nbc.com/live?brand=msnbc&callsign=msnbc',
        nbcnews: 'https://www.nbc.com/live?brand=nbc-news&callsign=nbcnews',
        bravo: 'https://www.nbc.com/live?brand=bravo&callsign=bravo_east',
        bravop: 'https://www.nbc.com/live?brand=bravo&callsign=bravo_west',
        e: 'https://www.nbc.com/live?brand=e&callsign=e_east',
        ep: 'https://www.nbc.com/live?brand=e&callsign=e_west',
        golf: 'https://www.nbc.com/live?brand=golf&callsign=golf',
        oxygen: 'https://www.nbc.com/live?brand=oxygen&callsign=oxygen_east',
        oxygenp: 'https://www.nbc.com/live?brand=oxygen&callsign=oxygen_west',
        syfy: 'https://www.nbc.com/live?brand=syfy&callsign=syfy_east',
        syfyp: 'https://www.nbc.com/live?brand=syfy&callsign=syfy_west',
        usa: 'https://www.nbc.com/live?brand=usa&callsign=usa_east',
        usap: 'https://www.nbc.com/live?brand=usa&callsign=usa_west',
        universo: 'https://www.nbc.com/live?brand=nbc-universo&callsign=universo_east',
        universop: 'https://www.nbc.com/live?brand=nbc-universo&callsign=universo_west',
        necn: 'https://www.nbc.com/live?brand=necn&callsign=necn',
        nbcsbayarea: 'https://www.nbc.com/live?brand=rsn-bay-area&callsign=nbcsbayarea',
        nbcsboston: 'https://www.nbc.com/live?brand=rsn-boston&callsign=nbcsboston',
        nbcscalifornia: 'https://www.nbc.com/live?brand=rsn-california&callsign=nbcscalifornia',
        nbcschicago: 'https://www.nbc.com/live?brand=rsn-chicago&callsign=nbcschicago',
        nbcsphiladelphia: 'https://www.nbc.com/live?brand=rsn-philadelphia&callsign=nbcsphiladelphia',
        nbcswashington: 'https://www.nbc.com/live?brand=rsn-washington&callsign=nbcswashington',
        weatherscan: 'https://v2.weatherscan.net/',
        windy: 'https://windy.com',
        gpu: 'chrome://gpu',
      }[name]
    }

    // Minimizing on Windows might cause more lag?  So only do it on Mac?
    var minimizeWindow = false
    if (process.platform == 'darwin' && u.includes("www.nbc.com")) minimizeWindow = true;

    async function setupPage(browser) {
      
      // Create a new page
      var newPage = await browser.newPage();

      // Stabilize it
      await newPage.setBypassCSP(true); // Sometimes needed for puppeteer-stream
      await delay(1000); // Wait for the page to be stable

      // Now try to enable stream capabilities
      if (newPage.getStream) {
        console.log('Stream capabilities already present');
      } else {
        console.log('Need to initialize stream capabilities');
        // Here you might need to reinitialize puppeteer-stream
      }
      
      // Show browser error messages, but for Sling filter out Sling Mixed Content warnings
      newPage.on('console', msg => {
        const text = msg.text();
        // Filter out messages containing "Mixed Content"
        if (!text.includes("Mixed Content")) {
          console.log(text);
        }
      });

      return newPage;
    }

    var browser, page
    try {
      browser = await getCurrentBrowser()
      page = await setupPage(browser);
      
    } catch (e) {
      console.log('failed to start browser page', u, e)
      res.status(500).send(`failed to start browser page: ${e}`)
      return
    }

    try {
      const stream = await getStream(page, {
        videoCodec: encodingParams.videoCodec,
        audioCodec: encodingParams.audioCodec,
        video: true,
        audio: true,
        videoBitsPerSecond: encodingParams.videoBitsPerSecond,
        audioBitsPerSecond: encodingParams.audioBitsPerSecond,
        mimeType: encodingParams.mimeType,
        videoConstraints: {
          mandatory: {
            minWidth: viewport.width,
            minHeight: viewport.height,
            maxWidth: viewport.width,
            maxHeight: viewport.height,
            minFrameRate: encodingParams.minFrameRate,
            maxFrameRate: encodingParams.maxFrameRate,
          },
        },
      })

      console.log('streaming', u)
      stream.pipe(res)
      res.on('close', async err => {
        await stream.destroy()
        await page.close()
        console.log('finished', u)
      })
    } catch (e) {
      console.log('failed to start stream', u, e)
      res.status(500).send(`failed to start stream: ${e}`)
      await page.close()
      return
    }

    try {
      // go to the page
      await page.goto(u)

      //  get some additional info about the page
      const uiSize = await page.evaluate(`(function() {
        return {
          height: window.outerHeight - window.innerHeight,
          width: window.outerWidth - window.innerWidth,
        }
      })()`)
      const session = await page.target().createCDPSession()
      const {windowId} = await session.send('Browser.getWindowForTarget')
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: {
          height: viewport.height + uiSize.height,
          width: viewport.width + uiSize.width,
        },
      })
      if (minimizeWindow) {
        await session.send('Browser.setWindowBounds', {
          windowId,
          bounds: {
            windowState: 'minimized',
          },
        })
      }
    } catch (e) {
      console.log('failed to goto page and setup window', u, e)
    }

    // For NBC, look for video element and wait for it to be ready
    if (u.includes("www.nbc.com")) {
      console.log("URL contains www.nbc.com");
      try {
        await page.waitForSelector('video')
        await page.waitForFunction(`(function() {
          let video = document.querySelector('video')
          return video.readyState === 4
        })()`)
        await page.evaluate(`(function() {
          let video = document.querySelector('video')
          video.style.setProperty('position', 'fixed', 'important')
          video.style.top = '0'
          video.style.left = '0'
          video.style.width = '100%'
          video.style.height = '100%'
          video.style.zIndex = '999000'
          video.style.background = 'black'
          video.style.cursor = 'none'
          video.style.transform = 'translate(0, 0)'
          video.style.objectFit = 'contain'
          video.play()
          video.muted = false
          video.removeAttribute('muted')

          let header = document.querySelector('.header-container')
          if (header) {
            header.style.zIndex = '0'
          }
        })()`)

      } catch (e) {
        console.log('failed to start stream', u, e)
      }
    }

    // Handle Sling TV
    else if (u.includes("watch.sling.com")) {
      console.log("URL contains watch.sling.com");
      try {
        // Div tag names can be found in the Chrome DevTools Layout tab

        // Click the full screen button
        const fullScreenButton = await page.waitForSelector('div.player-button.active.videoPlayerFullScreenToggle');
        await fullScreenButton.click(); //click for fullscreen

        // Find Mute button and then use volume slider
        const muteButton = await page.waitForSelector('div.player-button.active.volumeControls');
        await muteButton.click(); //click unmute

        // Simulate pressing the right arrow key 10 times to max volume
        for (let i = 0; i < 10; i++) {
          await delay(200);
          await page.keyboard.press('ArrowRight');
        }   

        console.log("Set Sling to Full Screen and Volume to max");
        
      } catch (e) {
        // Handle any errors specific to watch.spectrum.com...
        console.log('Error for watch.sling.com:', e);
      }
    }

    // Handle Google Photos
    else if (u.includes("photos.app.goo.gl")) {
      console.log("URL contains photos.app.goo.gl");
      try {
        
        // Simulate pressing the tab key key 10 times to get to the More Options button
        for (let i = 0; i < 8; i++) {
          await delay(200);
          await page.keyboard.press('Tab');
        }   

        // Press Enter twice to start Slideshow
        await page.keyboard.press('Enter');
        await delay(200);
        await page.keyboard.press('Enter');
        
        console.log("Started Google Slideshow");
        
      } catch (e) {
        // Handle any errors specific to photos.google.com...
        console.log('Error for photos.google.com:', e);
      }
    }

    // Handle DirecTV Stream
    else if (u.includes("stream.directv.com")) {
      console.log("URL contains stream.directv.com");
      try {

        // Extract the channel name from the "ch" query parameter of the URL
        // e.g. http://localhost:5589/stream?url=http://stream.directv.com/guide&ch=1234
        const channel = req.query.ch;

        // Simulate pressing the Tab key 6 times
        for (let i = 0; i < 6; i++) {
            await delay(500);
            await page.keyboard.press('Tab');
        }
        console.log('Searching DirecTVStream Channel List for: ', channel);
        await page.keyboard.type(channel); // Use the variable without quotes      
        await delay(1115);
        await page.mouse.click(755, 150, { button: 'left' }); // Second click (left-click) - Only line added
        console.log('Waiting for channel load: ' + channel);
        await delay(10000);
        console.log('Channel loaded, going Full Screen: ' + channel);

        // Trigger fullscreen mode using the Fullscreen API
        await page.evaluate(() => {
          const element = document.documentElement;
          if (element.requestFullscreen) {
            element.requestFullscreen();
          } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
          } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
          } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
          }
        });
      } catch (e) {
        console.log('Error for stream.directv.com:', e);
      }
    } 
  })

  const server = app.listen(argv.port, () => {
    console.log('Chrome Capture server listening on port', argv.port);
  })
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
