"""Update the existing MP4 narration without re-rendering its picture track."""
import io
import json
import shutil
import subprocess
import wave
from pathlib import Path
from verify_audio import verify, ROOT

def main():
    verify()
    video = ROOT / 'public' / 'workday-khmer-guide.mp4'
    if not video.is_file():
        raise RuntimeError('Export the video first with npm run render.')
    ffmpeg = shutil.which('ffmpeg') or str(ROOT / 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe')
    steps = json.loads((ROOT / 'narration.json').read_text(encoding='utf-8'))
    rate = 16000
    samples = bytearray(round(steps[-1]['endTime'] * rate) * 2)
    for step in steps:
        clip = ROOT / 'public' / step['audioUrl'].lstrip('/')
        decoded = subprocess.check_output([
            ffmpeg, '-v', 'error', '-i', str(clip), '-f', 'wav', '-acodec', 'pcm_s16le',
            '-ac', '1', '-ar', str(rate), 'pipe:1',
        ])
        with wave.open(io.BytesIO(decoded), 'rb') as audio:
            data = audio.readframes(audio.getnframes())
        offset = round(step['startTime'] * rate) * 2
        assert offset + len(data) <= round(step['endTime'] * rate) * 2
        samples[offset:offset + len(data)] = data
    output = ROOT / 'out'
    output.mkdir(exist_ok=True)
    soundtrack = output / 'narration-khmer.wav'
    with wave.open(str(soundtrack), 'wb') as audio:
        audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        audio.writeframes(samples)
    temporary = output / 'workday-khmer-guide.updated.mp4'
    subprocess.run([
        ffmpeg, '-v', 'error', '-y', '-i', str(video), '-i', str(soundtrack),
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac',
        '-b:a', '128k', '-t', str(steps[-1]['endTime']), '-movflags', '+faststart', str(temporary),
    ], check=True)
    assert temporary.stat().st_size > 0
    shutil.copyfile(temporary, video)
    print('Updated public/workday-khmer-guide.mp4; original picture track preserved.')

if __name__ == '__main__':
    main()
