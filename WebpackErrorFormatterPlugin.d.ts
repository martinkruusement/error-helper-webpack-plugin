/**
 * Plugin conf
 * @typedef {object} WebpackErrorFormatterPluginConf
 * @property {boolean} [bail] - Exit webpack after encountering errors.
 * @property {object} [tts] - Text-to-speech summarization with ElevenLabs
 * @property {boolean} [tts.active] - False to disable, or leave out the tts conf
 * @property {'local'|'ElevenLabs'} [tts.engine] - TTS Provider. Local for builtin Siri
 * @property {string} [tts.voiceId] - Copy ID on the voice page to get it.
 * @property {string} [tts.apiKey] - Create one: {@see https://elevenlabs.io/app/settings/api-keys}
 * @property {5|number|boolean} [popup] - Show a poup window with the error details (MacOS only) default: (5) or number of seconds
 * @property {object} [log] - Logging options.
 * @property {false|string} [log.name] - Show log-group name before messages.
 * @property {false|string} [log.name] - Show log-group name before messages.
 * @property {'trace'|'debug'|'info'|'warn'|'error'|'silent'} [log.level] - The minimum level of logging calls to show.
 * @property {boolean} [debug] - Debug logging for the plugin itself.
 */

/**
 * Parsed error message
 * @typedef {object} WebpackErrorFormatterPluginMessage
 * @property {string} title - Generic title, used for popup window.
 * @property {string} frame - Code frame: source (with newlines) with surrounding context where the error occured happened.
 * @property {string} summary - Simple one-line explanation.
 * @property {string} filePath - Directory name
 * @property {string} fileName - Suspect file name with extension
 * @property {string} time - How many seconds to show it 
 */
