"""Generate Khmer narration from the reviewable narration.json script."""
import asyncio
import argparse
import hashlib
import json
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent
VOICE = 'km-KH-SreymomNeural'
RATE = '+5%'

async def main(force=False):
    steps = json.loads((ROOT / 'narration.json').read_text(encoding='utf-8'))
    output = ROOT / 'public' / 'voiceover'
    output.mkdir(parents=True, exist_ok=True)
    cache_path = output / '.generation-cache.json'
    cache = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
    semaphore = asyncio.Semaphore(1)
    async def generate(step):
        target = output / (Path(step['audioUrl']).name)
        fingerprint = hashlib.sha256((VOICE + RATE + step['narrationKm']).encode('utf-8')).hexdigest()
        if not force and target.exists() and target.stat().st_size and cache.get(step['stepId']) == fingerprint:
            print(f"Cached {target.name}", flush=True)
            return
        async with semaphore:
            temporary = target.with_suffix('.mp3.tmp')
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(step['narrationKm'], VOICE, rate=RATE).save(str(temporary))
                    if temporary.stat().st_size == 0:
                        raise RuntimeError(f"Generated audio is empty: {target.name}")
                    temporary.replace(target)
                    cache[step['stepId']] = fingerprint
                    cache_path.write_text(json.dumps(cache, indent=2), encoding='utf-8')
                    print(f"Generated {target.name}: {target.stat().st_size} bytes", flush=True)
                    break
                except Exception:
                    temporary.unlink(missing_ok=True)
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2 ** attempt)
    results = await asyncio.gather(*(generate(step) for step in steps), return_exceptions=True)
    failures = [str(result) for result in results if isinstance(result, Exception)]
    if failures:
        raise RuntimeError('Narration generation failed; existing clips were preserved: ' + '; '.join(failures))
    from verify_audio import verify
    verify(write_metadata=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true')
    asyncio.run(main(parser.parse_args().force))
