const {launch, getStream} = require('puppeteer-stream')
const fs = require('fs')
const child_process = require('child_process')
const process = require('process')
const path = require('path')
const express = require('express')

const viewport = {
  width: 1920,
  height: 1080,
}

var currentBrowser

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
    executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else if (process.platform === 'win32') {
    executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  } else {
    throw new Error('Unsupported platform: ' + process.platform)
  }

  return executablePath
}

async function main() {
  const app = express()

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

  app.get('/stream/:name?', async (req, res) => {
    var u = req.query.url
    let name = req.params.name
    if (name) {
      u = {
        cnbc: 'https://www.nbc.com/live?brand=cnbc&callsign=cnbc',
        nbcnews: 'https://www.nbc.com/live?brand=nbc-news&callsign=nbcnews',
        weatherscan: 'https://weatherscan.net/',
        windy: 'https://windy.com',
      }[name]
    }

    var waitForVideo = true
    switch (name) {
      case 'weatherscan':
      case 'windy':
        waitForVideo = false
    }
    var minimizeWindow = false
    if (process.platform == 'darwin') minimizeWindow = true

    if (!currentBrowser || !currentBrowser.isConnected()) {
      currentBrowser = await launch({
        executablePath: getExecutablePath(),
        defaultViewport: null, // no viewport emulation
        userDataDir: path.join(process.cwd(), 'chromedata'),
        args: ['--disable-notifications', '--no-first-run', '--disable-infobars', '--hide-crash-restore-bubble'],
        ignoreDefaultArgs: [
          '--enable-automation',
          '--disable-extensions',
          '--disable-component-update',
          '--enable-blink-features=IdleDetection',
        ],
      })
      currentBrowser.on('close', () => {
        currentBrowser = null
      })
      currentBrowser.pages().then(pages => {
        pages.forEach(page => page.close())
      })
    }

    let browser = currentBrowser
    const page = await browser.newPage()
    //page.on('console', msg => console.log(msg.text()))

    try {
      const stream = await getStream(page, {
        video: true,
        audio: true,
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 128000,
        mimeType: 'video/webm;codecs=H264',
        videoConstraints: {
          mandatory: {
            minWidth: viewport.width,
            minHeight: viewport.height,
            maxWidth: viewport.width,
            maxHeight: viewport.height,
            minFrameRate: 60,
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
      await page.goto(u)
      if (waitForVideo) {
        await page.waitForSelector('video')
        await page.waitForFunction(() => {
          let video = document.querySelector('video')
          return video.readyState === 4
        })
        await page.evaluate(() => {
          let video = document.querySelector('video')
          video.style.position = 'fixed'
          video.style.top = '0'
          video.style.left = '0'
          video.style.width = '100%'
          video.style.height = '100%'
          video.style.zIndex = '999000'
          video.style.background = 'black'
          video.style.cursor = 'none'
          video.play()
        })
      }

      const uiHeight = await page.evaluate(() => {
        return window.outerHeight - window.innerHeight
      })
      const session = await page.target().createCDPSession()
      const {windowId} = await session.send('Browser.getWindowForTarget')
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: {
          height: viewport.height + uiHeight,
          width: viewport.width,
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
      console.log('failed to stream', u, e)
    }
  })

  const server = app.listen(5589, () => {
    console.log('Chrome Capture server listening on port 5589')
  })
}

main()
