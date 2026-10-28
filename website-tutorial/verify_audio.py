"""Decode every bundled Khmer clip and verify it fits the authored timeline."""
import argparse
import hashlib
import io
import json
import shutil
import struct
import wave
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def verify(write_metadata=False):
    binary_dir = ROOT / 'node_modules' / '@remotion' / 'compositor-win32-x64-msvc'
    probe = shutil.which('ffprobe') or str(binary_dir / 'ffprobe.exe')
    ffmpeg = shutil.which('ffmpeg') or str(binary_dir / 'ffmpeg.exe')
    steps = json.loads((ROOT / 'narration.json').read_text(encoding='utf-8'))
    metadata = {}
    previous_end = 0
    for step in steps:
        assert step['startTime'] == previous_end, f"Timeline gap: {step['stepId']}"
        assert step['endTime'] > step['startTime']
        assert any('\u1780' <= char <= '\u17ff' for char in step['narrationKm'])
        previous_end = step['endTime']
        path = ROOT / 'public' / step['audioUrl'].lstrip('/')
        assert path.is_file() and path.stat().st_size > 0, f'Missing audio: {path}'
        result = json.loads(subprocess.check_output([
            probe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path),
        ]))
        duration = float(result['format']['duration'])
        assert duration <= step['endTime'] - step['startTime'], f"Narration would be cut off: {step['stepId']}"
        pcm = subprocess.check_output([
            ffmpeg, '-v', 'error', '-i', str(path), '-f', 'wav', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '16000', 'pipe:1',
        ])
        with wave.open(io.BytesIO(pcm), 'rb') as decoded:
            samples = decoded.readframes(decoded.getnframes())
        peak = max(abs(sample[0]) / 32768 for sample in struct.iter_unpack('<h', samples))
        assert peak > 0.001, f"Silent audio: {step['stepId']}"
        metadata[step['stepId']] = {'duration': duration, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        print(f"{step['stepId']}: decoded {duration:.3f}s, peak {peak:.3f}; fits scene", flush=True)
    if write_metadata:
        (ROOT / 'src' / 'audio-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    else:
        saved = json.loads((ROOT / 'src' / 'audio-metadata.json').read_text(encoding='utf-8'))
        assert metadata == saved, 'Audio metadata is stale; run python verify_audio.py --write.'
    return metadata

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true')
    verify(parser.parse_args().write)
