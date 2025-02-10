const path = require('path')
const osascript = require('node-osascript')
const getLogger = require('webpack-log')
const { isString } = require('radash')

const StripAnsi = import('strip-ansi')
let stripAnsi
const Chalk = import('chalk')
let chalk
const Execa = import('execa')
let execa

let print // logger
const _tag = '▓\n▓ [  Webpack error analyzer ]'
let tag = _tag // add color codes when Chalk loaded

/** @import { Compiler, Stats, WebpackError } from 'webpack' */
/** @import {WebpackErrorFormatterPluginConf} from './WebpackErrorFormatterPlugin.d.ts' */
/** @import {WebpackErrorFormatterPluginMessage} from './WebpackErrorFormatterPlugin.d.ts' */

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
      /**
       * @param {Stats} stats - The Webpack compiler instance.
       * @param {Function} callback - Continue the build chain
       */
      async (stats, callback) => {
        stripAnsi ??= (await StripAnsi).default
        chalk ??= new (await Chalk).Chalk()
        if (tag === _tag) tag = chalk.red(_tag)
        execa ??= await Execa

        if (!stats.compilation.errors?.length) {
          callback()
          return
        }

        /** @type {WebpackError} */
        const err = stats.compilation.errors[0]
        if (this.conf?.debug) printError(err)

        const message = await buildMessage(err, this.conf)
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
/* eslint-disable-next-line  sonarjs/cognitive-complexity -- linear enough */
async function buildMessage (err, conf) {
  console.error(tag, 'INCOMING ERROR MESSAGE', err.message, conf)

  stripAnsi ??= (await StripAnsi).default

  console.log(tag, 'buildMessage Error:', err)
  console.log(tag, 'buildMessage conf:', conf)
  if (!err?.module) {
    console.error('NO err.MODULE')
    console.error(err.message)
    console.error(err.cause)
    console.error(err.stack)
    console.log(Object.keys(err))
    console.log(tag, 'Is this a regular TS error?.')
    console.log(tag, 'Ignore it.')
    console.log(tag, 'Shown anyway already.')
    return
  }

  let cause = null
  const path = err?.module?.resourceResolveData?.path?.split('/') ?? ['UNKNOWN_FILE']
  const message = err?.message ?? 'NO_MESSAGE'
  const fileName = path.pop()
  const filePath = path.join('/')
  const lines = message.split('\n')

  console.warn('>>>> line 1', isString(lines?.[1]), lines?.[1])
  if (isString(lines?.[1])) {
    console.log('stripAnsi:')
    console.log(typeof stripAnsi, stripAnsi)

    cause = stripAnsi(lines?.[1])
    const endOfTag = cause.indexOf('] ') + 2
    const beginningOfSource = cause.lastIndexOf(' (') - 2
    cause = cause?.slice(endOfTag).slice(0, beginningOfSource)
  }

  cause ??= err.message

  console.log('[WPEFP]', '------ lines -----')
  for (const l in lines) {
    console.log(l, '=>', lines[l])
  }
  console.log('[WPEFP]', '------ lines -----')

  console.warn(tag, '------ pre-vue-cause -----')
  console.error(cause)
  console.warn(tag, '------ pre-vue-cause -----')

  if (!cause) {
    cause = lines.find((l) => l.includes('VueCompilerError:'))
    console.log('[WPEFP]', 'Looking for alternative cause [VueCompilerError?]', 'lines', lines)
    if (cause) {
      cause = cause.split('VueCompilerError:').pop().trim()
    }
    if (isString(cause)) {
      if (cause.endsWith('.')) cause = cause.slice(0, -1)
    }
  }

  console.error(tag, 'CAUSE CONFIRMED:', cause)

  let useLineContext = true
  let lineNumber = 0
  let columnNumber = 0

  let explanation = ''
  let lineSection = ''
  let contextSection = ''

  console.log(tag, 'cause:', cause)

  const fileNameOptimized = fileName.toLowerCase().endsWith('.vue') ? `${fileName.slice(0, -4)} component` : fileName
  if (cause.includes('expected ","')) {
    explanation = `${fileNameOptimized} needs a comma`
    useLineContext = true
  }
  if (cause.includes('Duplicate attribute')) {
    explanation = `${fileNameOptimized} has a duplicate attribute`
    useLineContext = true
  }

  if (!isString(lines[1])) {
    useLineContext = false
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

  // TODO:  refactor: only do the stuff previously if no analyzer engine is active 
  const analyzer = conf?.analyzer
  if (analyzer?.active) {
    if (analyzer.engine === 'OpenAI') {
      console.log(tag, 'OKAYHERE:', err.message)
      const result = await openaiErrorAnalyzer(err, conf)
      console.log(tag, 'OPENAI RESULT:', result)
      summary = result
    }
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
  console.warn('>>> stripAnsi getCodeFrame', stripAnsi)

  const lines = err.message.split('\n').slice(4).map(stripAnsi)
  console.warn(tag, 'getCodeFrame BEFORE', err.message)
  const frame = lines.join('\n')
  console.warn(tag, 'getCodeFrame AFTER', frame)
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
  const debug = conf?.debug ?? false
  try {
    const cliArgs = [`${__dirname}/elevenlabs-tts-stream.py`, message.summary]
    const cliArgsPreview = [`${__dirname}/elevenlabs-tts-stream.py`, `"${message.summary}"`]
    if (conf.tts.apiKey) cliArgs.push(conf.tts.apiKey)
    if (conf.tts.apiKey) cliArgsPreview.push(conf.tts.apiKey)
    if (conf.tts.apiKey) cliArgs.push(conf.tts.voiceId)
    if (conf.tts.apiKey) cliArgsPreview.push(conf.tts.voiceId)
    if (debug) print.info('Run:\n', cliArgsPreview.join(' '))
    const ttsProcess = execa.execa('python3', cliArgs, { detached: true })
    ttsProcess.unref()
  } catch (e) {
    print.error("Could not start 'elevenlabs-tts-stream.py':")
    print.error(e)
  }
}

/** 
 * @param {WebpackErrorFormatterPluginMessage} errorFramePlain - Error from Webpack Compiler
 * @param errorFramePlain
 * @param {WebpackErrorFormatterPluginConf} conf - Plugin configuration
 */
async function openaiErrorAnalyzer (errorFramePlain, conf) {
  console.info(tag, 'openaiErrorAnalyzer', errorFramePlain, conf)
  const debug = conf?.debug ?? false
  let response = 'No response.'
  const errorFrameB64 = btoa(errorFramePlain)
  console.info(tag, 'Base64 ENCODED ERROR:', errorFrameB64)
  try {
    const cliArgs = [`${__dirname}/openai-error-analyzer.py`, errorFrameB64]
    const cliArgsPreview = [`${__dirname}/elevenlabs-tts-stream.py`, `"${errorFrameB64}"`]
    if (conf?.apiKey) cliArgs.push(conf.apiKey)
    if (debug) print.info('Run:\n', cliArgsPreview.join(' '))
    const analyzerProcess = await execa.execa('python3', cliArgs)
    response = analyzerProcess.stdout
    console.log('WE HAVE AN EXPLANATION:', analyzerProcess)
    return response
  } catch (e) {
    response = "Could not start 'openai-error-analyzer.py':"
    print.error("Could not start 'openai-error-analyzer.py':")
    print.error(e)
  }

  return response
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
