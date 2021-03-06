'use strict'

const debug = require('debug-logfmt')('browserless')
const pReflect = require('p-reflect')
const pidtree = require('pidtree')

// flags explained: https://peter.sh/experiments/chromium-command-line-switches/
// default flags: https://github.com/puppeteer/puppeteer/blob/master/lib/Launcher.js#L269
// AWS Lambda flags: https://github.com/alixaxel/chrome-aws-lambda/blob/10feb8d162626d34aad2ee1e657f20956f53fe11/source/index.js
const args = ({ proxy }) =>
  [
    // base
    '--disable-cloud-import',
    '--disable-gesture-typing',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-offer-store-unmasked-wallet-cards',
    '--disable-offer-upload-credit-cards',
    '--disable-print-preview',
    '--disable-speech-api',
    '--disable-tab-for-desktop-share',
    '--disable-translate',
    '--disable-voice-input',
    '--disable-wake-on-wifi',
    '--enable-async-dns',
    '--enable-simple-cache-backend',
    '--enable-tcp-fast-open',
    '--enable-webgl',
    '--hide-scrollbars',
    '--ignore-gpu-blocklist',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-pings',
    '--no-zygote',
    '--prerender-from-omnibox=disabled',
    '--use-gl=swiftshader',
    '--no-sandbox',
    // disable navigator.webdriver
    /// https://stackoverflow.com/a/60409220
    // https://blog.m157q.tw/posts/2020/09/11/bypass-cloudflare-detection-while-using-selenium-with-chromedriver/
    '--disable-blink-features=AutomationControlled',
    // extra
    '--disable-web-security',
    '--font-render-hinting=none', // could be 'none', 'medium'
    // '--enable-font-antialiasing'
    // perf
    // '--single-process',
    // '--memory-pressure-off',
    proxy && `--proxy-server=${proxy.protocol}://${proxy.hostname}:${proxy.port}`
  ].filter(Boolean)

const spawn = (puppeteer, { mode = 'launch', proxy, ...launchOpts }) =>
  puppeteer[mode]({
    ignoreHTTPSErrors: true,
    // flags explained: https://peter.sh/experiments/chromium-command-line-switches/
    // default flags: https://github.com/puppeteer/puppeteer/blob/master/lib/Launcher.js#L269
    // AWS Lambda flags: https://github.com/alixaxel/chrome-aws-lambda/blob/10feb8d162626d34aad2ee1e657f20956f53fe11/source/index.js
    args: args({ proxy }),
    ...launchOpts
  })

const getPid = childProcess => {
  if (!childProcess) return null
  if (childProcess.pid) return childProcess.pid
  const browserProcess = childProcess.process ? childProcess.process() : undefined
  if (!browserProcess) return null
  return browserProcess.pid
}

const getPids = async pid => {
  const { value: pids = [] } = await pReflect(pidtree(pid))
  return pids.includes(pid) ? pids : [...pids, pid]
}

const close = async (childProcess, { signal = 'SIGKILL', ...debugOpts } = {}) => {
  const pid = getPid(childProcess)
  if (!pid) return

  const pids = await getPids(pid)

  pids.forEach(pid => {
    try {
      process.kill(pid, signal)
    } catch (error) {
      debug('error', { pid, signal, ...debugOpts, message: error.message || error })
    }
  })

  // It's necessary to call `browser.close` for removing temporal files associated
  // and remove listeners attached to the main process
  // see https://github.com/puppeteer/puppeteer/blob/main/src/node/BrowserRunner.ts#L129
  if (childProcess.close) await childProcess.close()

  debug('close', { pids, signal, ...debugOpts })

  return { pids }
}

module.exports = { getPid, spawn, close, args }
