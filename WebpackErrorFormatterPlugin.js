const path = require('path')
const osascript = require('node-osascript')
const getLogger = require('webpack-log')

const Chalk = import("chalk")
let chalk
const Execa = import("execa")
let execa

let print // logger

/** @import { Compiler, Stats, WebpackError } from 'webpack' */
/** @import {WebpackErrorFormatterPluginConf} from './WebpackErrorFormatterPlugin' */
/** @import {WebpackErrorFormatterPluginMessage} from './WebpackErrorFormatterPlugin' */

/** 
 * Webpack Error Formatter Plugin
 * @class WebpackErrorFormatterPlugin
 * @member {WebpackErrorFormatterPluginConf} conf - Configuration options for the plugin.
 */
class WebpackErrorFormatterPlugin {
  /**
   * @param {WebpackErrorFormatterPluginConf} conf - Configuration options for the plugin.
   */
  constructor (conf) {
    /** @type {WebpackErrorFormatterPluginConf} */
    this.conf = conf

    print = createLoggerAdapter(conf)
    print.info('WebpackErrorFormatterPlugin INIT')
    print.info('WebpackErrorFormatterPlugin conf', conf)
  }

  /**
   * Apply the plugin to the compiler.
   * @param {Compiler} compiler - The Webpack compiler instance.
   */
  async apply (compiler) {
    compiler.hooks.done.tapAsync('WebpackErrorFormatterPlugin',
      /** @param {Stats} stats - The Webpack compiler instance. */
      async (stats, callback) => {

        chalk ??= new (await Chalk).Chalk()
        execa ??= await Execa

        if (!stats.compilation.errors?.length) {
          callback()
          return
        }

        /** @type {WebpackError} */
        const err = stats.compilation.errors[0]
        if (this.conf?.debug) printError(err)

        const message = buildMessage(err, this.conf)
        if (this.conf?.debug) print.info('Error message built:', message)
        if (this.conf?.tts && this.conf?.tts?.active !== false) {
          playTTSMessage(message, this.conf)
        }

        if (this.conf?.popup) {
          showPopup(message, this.conf)
        }

        if (this.conf?.bail) {
          // eslint-disable-next-line n/no-process-exit -- process.exitCode = 1 continues to compile anyway
          wait(message.time * 1000).then(() => { process.exit(1) })
        }

        callback()
      })
  }
}

function createLoggerAdapter (conf) {
  const name = conf?.log?.name
  const level = conf?.log?.level ?? 'info'
  const options = {
    // name
    level,
    timestamps: !!conf?.log?.timestamps,
    unqiue: !!conf?.log?.unique
    // symbol map
    // color map
  }

  if (conf?.log?.name) {
    options.name = name
  }

  const loggerAdapter = getLogger(options)

  loggerAdapter.err = loggerAdapter.error
  return loggerAdapter
}

/**
 * Translate JS errors to a single line of text
 * @param {WebpackError} err - Error from Webpack Compiler
 * @param {WebpackErrorFormatterPluginConf} conf - Plugin configuration
 * @returns {WebpackErrorFormatterPluginMessage} - A sentence describing what went wrong.
 */
function buildMessage (err, conf) {
  const path = err.module.resourceResolveData.path.split('/')
  const fileName = path.pop()
  const filePath = path.join('/')
  const lines = err.message.split('\n')
  const cause = lines[1].slice(lines[1].indexOf('] ') + 2).slice(0, lines[1].lastIndexOf(' (') - 2)
  let useLineContext = true
  let lineNumber = 0
  let columnNumber = 0

  let explanation = ''
  let lineSection = ''
  let contextSection = ''

  const fileNameOptimized = fileName.toLowerCase().endsWith('.vue') ? `${fileName.slice(0, -4)} component` : fileName
  if (cause.includes('expected ","')) {
    explanation = `${fileNameOptimized} needs a comma`
    useLineContext = true
  }

  if (useLineContext) {
    [lineNumber, columnNumber] = lines[1].slice(lines[1].lastIndexOf(' (') + 2, -1).split(':').map((s) => parseInt(s))
    let contextLine = ''
    lines.forEach((l, i) => {
      if (contextLine) return
      if (l.endsWith('^')) {
        contextLine = (lines[i - 1] ?? '').trim()
        lineNumber = contextLine.split('|').shift()
        lineNumber = parseInt(lineNumber)
      }
    })

    // This works because 0 can't be a line number
    lineSection = lineNumber ? ` on line ${lineNumber}` : ''

    if (contextLine) {
      let rawContext = contextLine
      const entityBreaks = /[:,\s)(]/
      rawContext = rawContext.replace(/^\d+\s+\|\s*/, '')
      rawContext = rawContext.replace(entityBreaks, '__ENTITY_BREAK__').split('__ENTITY_BREAK__')[0].trim()
      if (rawContext) {
        contextSection = `near ${rawContext}`
      }
    }
  }

  let summary = `${explanation} ${lineSection} ${contextSection}`
  if (!summary.includes(fileName)) {
    summary = `${fileName}: ${summary}`
  }
  // Remove double spaces
  summary = summary.replaceAll(/\s+/g, ' ').trim()

  print.info(`✨ ${summary} ✨`)
  let time = conf.popup === true ? 5 : parseFloat(conf?.popup)
  if (conf?.popup === undefined) time = 0
  if (isNaN(time)) { time = 5 }

  if (conf?.debug) {
    print.info('| cause: ', cause)
    print.info('| line:  ', lineNumber)
    print.info('| column:', columnNumber)
    print.info('| useLineContext:', useLineContext)
    print.info('| contextSection:', contextSection)
    print.info('| explanation:', explanation)
  }

  const output = {
    title: 'Compilation failed',
    frame: getCodeFrame(err),
    summary,
    filePath,
    fileName,
    time
  }

  return output
}

/**
 * Translate JS errors to a single line of text
 * @param {WebpackErrorFormatterPluginMessage} err - Error from Webpack Compiler
 * @param {WebpackErrorFormatterPluginConf} conf - Plugin configuration
 * @returns {string} - Formatted lines at error source.
 */
function getCodeFrame (err, conf) {
  const lines = err.message.split('\n').slice(4)
  const frame = lines.join('\n')
  return frame
}

/**
 * Ask siri to read out the Error message summary
 * @param {WebpackErrorFormatterPluginMessage} message - Formatted and parsed error details
 * @param {WebpackErrorFormatterPluginConf} conf - Plugin configuration
 * @returns {void} - A sentence describing what went wrong.
 */
function showPopup (message, conf) {
  try {
    const popupProcess = execa.execa(`${__dirname}/ErrorPopup`, [
      message.title,
      message.frame,
      message.summary,
      message.fileName,
      message.filePath,
      message.time
    ], { detached: true })
    popupProcess.unref()
  } catch (error) {
    print.error('Popup failed')
    print.error('Error running the executable:', error)
  }
}

/**
 * Ask siri to read out the Error message summary
 * @param {WebpackErrorFormatterPluginMessage} message - Formatted and parsed error details
 * @param {WebpackErrorFormatterPluginConf} conf - Plugin configuration
 * @returns {void} - A sentence describing what went wrong.
 */
function playTTSMessage (message, conf) {
  if (conf.tts.engine === 'local') {
    localTTS (message, conf)
    return
  }

  if (conf.tts.engine === 'ElevenLabs') {
    elevenLabsTTS(message, conf)
    return
  }

  // TODO:  AI summarize the mesage based on the error and context 
  print.error('Could not determine the TTS engine:', conf.tts.engine)
}
/** 
 * @param {WebpackErrorFormatterPluginMessage} message - Error from Webpack Compiler
 * @param {WebpackErrorFormatterPluginConf} conf - Plugin configuration
 */
function localTTS (message, conf) {
  try {
    print.error('Try play TTSMessage (Local)')
    osascript.execute(`say "${message.summary}"`, null, function (err, result, raw) {
      if (err) { print.error('Local TTS Failed:', err) }
    })
  } catch (err) {
    print.error('Local TTS Failed:', err)
  }
}

/** 
 * @param {WebpackErrorFormatterPluginMessage} message - Error from Webpack Compiler
 * @param {WebpackErrorFormatterPluginConf} conf - Plugin configuration
 */
function elevenLabsTTS (message, conf) {
  try {
    const cliArgs = [`${__dirname}/elevenlabs-tts-stream.py`, message.summary]
    const cliArgsPreview = [`${__dirname}/elevenlabs-tts-stream.py`, `"${message.summary}"`]
    if (conf.tts.apiKey) cliArgs.push(conf.tts.apiKey)
    if (conf.tts.apiKey) cliArgsPreview.push(conf.tts.apiKey)
    if (conf.tts.apiKey) cliArgs.push(conf.tts.voiceId)
    if (conf.tts.apiKey) cliArgsPreview.push(conf.tts.voiceId)
    if (conf?.debug) print.info('Run:\n', cliArgsPreview.join(' '))
    const ttsProcess = execa.execa('python3', cliArgs, { detached: true })
    ttsProcess.unref()
  } catch (e) {
    print.error('Could not start the TTS Python3 script:')
    print.error(e)
  }
}

function printError (err, debug) {
  print.error(chalk.red('====== Raw error: ======'))
  print.info(JSON.stringify(err.loc, null, 2))
  const lineEntries = err.message.split('\n').map((line, i) => [parseInt(i), line])
  const lines = lineEntries.map(([i, line]) => line)
  const errorLine = lineEntries.findIndex(([i, line]) => !!line.match(/^\s\s\s\|\s+\^/)) ?? undefined
  let highlighted = []
  if (Number.isInteger(errorLine)) {
    highlighted = [errorLine - 1, errorLine + 1]
  }

  console.log('highlighted:', highlighted)
  console.log('errorLine:', errorLine)

  console.warn('LINES')
  console.warn(lines)
  console.warn('nomap')
  console.warn(err.message.split('\n'))
  console.warn('nomap')
  console.warn(err.message)
  console.warn('obk')
  console.warn(Object.keys(err.message))
  console.warn('ok')
  console.warn(Object.keys(err))
  for (const i in lines) {
    const line = lines[i]
    const index = parseInt(line)
    if (index === errorLine) {
      print.error(chalk.redBright(line))
      continue
    }
    if (highlighted.includes(index)) {
      print.error(chalk.yellowBright(line))
      continue
    }
    print.info(chalk.grey(line))
  }
  setImmediate(() => { print.error(chalk.red('====== ---------- ======')) })
}

/**
 * @param {500|number} [base] timeout
 * @param {0|number} [random] add random(0, target) milliseconds to the base sleep timer
 * @returns {Promise<void>} Resolves after base + random milliseconds
 * @example ```js
 * await wait(1000, 100) // wait randomly between 1000ms and 1100ms
 * await wait() // wait 500ms
 * ```
 */
function wait (base = 500, random = 0) {
  const time = base + random * Math.random()
  const promise = new Promise((resolve) => { setTimeout(resolve, time) })
  return promise
}

module.exports = WebpackErrorFormatterPlugin
