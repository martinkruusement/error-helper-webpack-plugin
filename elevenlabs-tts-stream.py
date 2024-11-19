import requests
import sys
import time
import os
import platform
from importlib.metadata import distributions

pyaudio = None       # import termcolor (optional)
termcolor = None       # import termcolor (optional)
AudioSegment = None    # from pydub import AudioSegment
play_buffer = None     # from simpleaudio import play_buffer
BytesIO = None         # from io import BytesIO
ElevenLabs = None      # from elevenlabs import ElevenLabs
VoiceSettings = None   # from elevenlabs import VoiceSettings

installed = {dist.metadata['Name'].lower() for dist in distributions()}
required = {
    'pyaudio',
    'termcolor',
    'pydub',
    'simpleaudio',
    'elevenlabs'
}


text = sys.argv[1] if len(sys.argv) > 1 else None
api_key = sys.argv[2] if len(sys.argv) > 2 else os.getenv("ELEVENLABS_API_KEY") or None
voice_id = sys.argv[3] if len(sys.argv) > 3 else os.getenv("ELEVENLABS_VOICE_ID") or "5izH2Qlr4ky45aDBTZE1"

model_id = "eleven_turbo_v2"
output_format = "mp3_44100_128"

metrics = {
    "timestamps": {
        "init": time.time(),
        "setup": None,
        "connect": None,
        "play": None,
    },
    "measurements": {
        "setup": None,
        "connect": None,
        "playing": None,
    }
}


def main():
    setup()
    check_dependencies()
    import_dependencies()
    check_usage()
    # metrics["measurements"]["setup ="]     metrics["measurements"]["connect"] = metrics["timestamps"]['play'] - metrics["timestamps"]['connect']
    stream_tts()

    pgreen("All done.")


def setup():
    metrics["timestamps"]['setup'] = time.time()
    if platform.system() == "Windows":
        os.system('color')

    if "termcolor" in installed:
        global termcolor
        import termcolor


def check_dependencies():
    missing = required - installed
    if missing:
        print()
        err = "Missing python dependencies:"
        plred(err)
        plgrey("---------------------------")

        for pkg in missing:
            print("pip install", pkg)

        raise SystemExit(yellow("\nInstall these required packages and try again.\n"))


def import_dependencies():
    global pyaudio
    global AudioSegment
    global play_buffer
    global BytesIO
    global ElevenLabs
    global VoiceSettings
    import pyaudio
    from pydub import AudioSegment
    from simpleaudio import play_buffer
    from io import BytesIO
    from elevenlabs import ElevenLabs, VoiceSettings


def print_usage():
    print()
    plgrey('Usage:')
    DBLQUOTES = yellow("\"")
    print('python script.py',
          lyellow('elevenlabs_api_key'),
          lyellow('voice_id'),
          DBLQUOTES+lyellow('Text here in quotes.')+DBLQUOTES)


def check_usage():
    if not api_key:
        print_usage()
        raise SystemExit(red("\nMissing Elevenlabs API KEY\n"))
    if not voice_id:
        print_usage()
        pyellow("Using default voice_id")
    if not text:
        print_usage()
        raise SystemExit(red("\nMissing text content for TTS\n"))


def stream_tts():
    metrics["timestamps"]['connect'] = time.time()
    metrics["measurements"]["setup"] = metrics["timestamps"]['connect'] - metrics["timestamps"]['setup']

    print(lgreen("stream_tts:"))
    print("api_key:", green(api_key))
    print("voice_id:", green(voice_id))
    print("text:", green(text))
    print()

    url = "https://api.elevenlabs.io/v1/text-to-speech/"+voice_id

    client = ElevenLabs(api_key=api_key)
    response = client.text_to_speech.convert_as_stream(
        voice_id=voice_id,
        model_id=model_id,
        optimize_streaming_latency="0",
        output_format=output_format,
        text=text,
        voice_settings=VoiceSettings(
            stability=0.1,
            similarity_boost=0.3,
            style=0.2,
            use_speaker_boost=True,
        )
    )

    data_stream = BytesIO()

    for chunk in response:
        print(green("New chunk."), len(chunk))
        # continue
        if chunk:
            data_stream.write(chunk)

    # Decode MP3 chunk to PCM using pydub
    data_stream.seek(0)
    audio = AudioSegment.from_file(data_stream, format="mp3")
    pcm_data = audio.raw_data

    # Debugging PCM data structure
    print(yellow("PCM Data Length:"), len(pcm_data))
    print("Channels:", audio.channels)
    print("Sample Width:", audio.sample_width)
    print("Frame Rate:", audio.frame_rate)
    print("PCM Data Length:", len(pcm_data))
    # Play the decoded PCM data

    metrics["timestamps"]['play'] = time.time()
    metrics["measurements"]["connect"] = metrics["timestamps"]['play'] - metrics["timestamps"]['connect']

    play_audio_buffer(audio)

    pgreen("exit tts")


def play_audio_buffer(audio):
    p = pyaudio.PyAudio()
    stream = p.open(format=p.get_format_from_width(audio.sample_width),
                    channels=audio.channels,
                    rate=audio.frame_rate,
                    output=True)
    stream.write(audio.raw_data)
    stream.stop_stream()
    stream.close()
    p.terminate()

def red(s): return termcolor.colored(s, "red") if termcolor else s
def pred(s): print(red(s), termcolor.RESET)
def lred(s): return termcolor.colored(s, "light_red") if termcolor else s
def plred(s): print(lred(s), termcolor.RESET)
def green(s): return termcolor.colored(s, "green") if termcolor else s
def pgreen(s): print(green(s), termcolor.RESET)
def lgreen(s): return termcolor.colored(s, "light_green") if termcolor else s
def plgreen(s): print(lgreen(s), termcolor.RESET)
def yellow(s): return termcolor.colored(s, "yellow") if termcolor else s
def pyellow(s): print(yellow(s), termcolor.RESET)
def lyellow(s): return termcolor.colored(s, "light_yellow") if termcolor else s
def plyellow(s): print(lyellow(s), termcolor.RESET)
def lgrey(s): return termcolor.colored(s, "light_grey") if termcolor else s
def plgrey(s): print(lgrey(s), termcolor.RESET)
def reset(): return termcolor.RESET


if __name__ == '__main__':
    main()
