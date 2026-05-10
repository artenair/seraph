"""
Computes MERT audio embeddings and Essentia+MusiCNN tags for all un-embedded
songs in a room and writes them back to Firestore.

Prerequisites:
    pip install -r requirements.txt
    yt-dlp on PATH
    ~/.ssh/seraph-firebase-sdk.json service account key

Usage:
    python embed_songs.py <roomId> [--force] [--limit N]
"""

# Suppress TF and library noise before any imports that trigger them
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TRANSFORMERS_VERBOSITY']  = 'error'
os.environ['TOKENIZERS_PARALLELISM']  = 'false'

import sys
import warnings
import logging
import subprocess
import argparse
import urllib.request
import contextlib
import random
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

SCRIPT_DIR = Path(__file__).parent
LOG_PATH   = SCRIPT_DIR / 'embed_songs.log'

# Route all library stderr noise to the log file
warnings.filterwarnings('ignore')
logging.basicConfig(filename=LOG_PATH, level=logging.DEBUG,
                    format='%(asctime)s %(levelname)s %(message)s')
_log_file   = open(LOG_PATH, 'a')
sys.stderr  = _log_file

import numpy as np
import torch
import librosa
import firebase_admin
from firebase_admin import credentials, firestore
from transformers import AutoModel, AutoFeatureExtractor
from rich.progress import (
    Progress, SpinnerColumn, BarColumn, TextColumn,
    TaskProgressColumn, TimeElapsedColumn,
)
from rich.console import Console

@contextlib.contextmanager
def silence():
    """Redirect stdout+stderr at the OS fd level to suppress C++ library noise."""
    devnull  = open(os.devnull, 'w')
    saved_1  = os.dup(1)
    saved_2  = os.dup(2)
    os.dup2(devnull.fileno(), 1)
    os.dup2(devnull.fileno(), 2)
    try:
        yield
    finally:
        os.dup2(saved_1, 1)
        os.dup2(saved_2, 2)
        os.close(saved_1)
        os.close(saved_2)
        devnull.close()

# ── Config ────────────────────────────────────────────────────────────────────

SERVICE_KEY   = Path.home() / '.ssh' / 'seraph-firebase-sdk.json'
AUDIO_CACHE   = SCRIPT_DIR / 'audio_cache'
MERT_MODEL    = 'm-a-p/MERT-v1-95M'
CLAP_MODEL    = 'laion/larger_clap_music'
MERT_SR       = 24000   # MERT native sampling rate
CLAP_SR       = 48000   # CLAP native sampling rate
ESSENTIA_SR   = 16000   # Essentia BPM/key rate
SEGMENT_S     = 10      # seconds per segment
SAMPLE_POINTS = [0.0, 0.25, 0.50, 0.75]

# CLAP zero-shot tag vocabulary.
# Longer, specific prompts score more distinctly than single words.
TAGS = [
    # Mood
    {'label': 'calm',        'prompt': 'calm and peaceful background music for relaxation'              },
    {'label': 'melancholic', 'prompt': 'melancholic and bittersweet emotional music'                    },
    {'label': 'tense',       'prompt': 'tense and suspenseful dramatic music'                           },
    {'label': 'dark',        'prompt': 'dark and ominous atmospheric background music'                  },
    {'label': 'mysterious',  'prompt': 'mysterious and eerie atmospheric background music'              },
    {'label': 'hopeful',     'prompt': 'hopeful and uplifting emotional music'                          },
    {'label': 'cheerful',    'prompt': 'cheerful and happy lighthearted background music'               },
    {'label': 'playful',     'prompt': 'playful and whimsical lighthearted music'                       },
    {'label': 'nostalgic',   'prompt': 'nostalgic and sentimental emotional music'                      },
    {'label': 'romantic',    'prompt': 'romantic and tender background music'                           },
    {'label': 'epic',        'prompt': 'epic and grand cinematic orchestral music'                      },
    {'label': 'heroic',      'prompt': 'heroic and triumphant action music'                             },
    {'label': 'sad',         'prompt': 'sad and sorrowful emotional music'                              },
    {'label': 'horror',      'prompt': 'horror and scary atmospheric music for horror games'            },
    # Energy
    {'label': 'ambient',     'prompt': 'slow ambient atmospheric background music'                      },
    {'label': 'gentle',      'prompt': 'gentle and soft quiet instrumental music'                       },
    {'label': 'action',      'prompt': 'fast and intense action packed music'                           },
    {'label': 'energetic',   'prompt': 'energetic and driving upbeat music'                             },
    # Instrumentation
    {'label': 'piano',       'prompt': 'solo piano or piano led instrumental music'                     },
    {'label': 'orchestral',  'prompt': 'full orchestral music with strings brass and woodwinds'         },
    {'label': 'guitar',      'prompt': 'acoustic or electric guitar led music'                          },
    {'label': 'electronic',  'prompt': 'electronic synthesizer based music'                             },
    {'label': 'choir',       'prompt': 'choral singing or vocal ensemble music'                         },
    {'label': 'strings',     'prompt': 'string quartet or string ensemble music'                        },
    # Style
    {'label': 'cinematic',   'prompt': 'cinematic film score background music'                          },
    {'label': 'lofi',        'prompt': 'lo-fi chill relaxing background music'                          },
    {'label': 'minimalist',  'prompt': 'minimalist sparse simple instrumental music'                    },
    {'label': 'japanese',    'prompt': 'japanese style background music from anime or video games'      },
    {'label': 'rpg',         'prompt': 'role playing game background music'                             },
]

# ── Firebase ──────────────────────────────────────────────────────────────────

firebase_admin.initialize_app(credentials.Certificate(str(SERVICE_KEY)))
db = firestore.client()

# ── MERT ──────────────────────────────────────────────────────────────────────

def load_mert():
    extractor = AutoFeatureExtractor.from_pretrained(MERT_MODEL, trust_remote_code=True)
    model     = AutoModel.from_pretrained(MERT_MODEL, trust_remote_code=True)
    model.eval()
    return extractor, model

def mert_embed(audio_24k, extractor, model):
    inputs = extractor(audio_24k, sampling_rate=MERT_SR, return_tensors='pt', padding=True)
    with torch.no_grad():
        outputs = model(**inputs, output_hidden_states=True)
    # Mean-pool the last hidden state over the time dimension → 1024-dim vector
    embedding = outputs.last_hidden_state.mean(dim=1).squeeze().numpy()
    norm = np.linalg.norm(embedding)
    return (embedding / norm).tolist() if norm > 0 else embedding.tolist()

# ── CLAP ─────────────────────────────────────────────────────────────────────

def load_clap():
    from transformers import ClapModel, ClapProcessor
    processor = ClapProcessor.from_pretrained(CLAP_MODEL)
    model     = ClapModel.from_pretrained(CLAP_MODEL)
    model.eval()
    return processor, model

def precompute_tag_embeddings(processor, model):
    from transformers import ClapModel
    prompts = [t['prompt'] for t in TAGS]
    inputs  = processor(text=prompts, return_tensors='pt', padding=True)
    with torch.no_grad():
        embeds = model.get_text_features(**inputs)
        if not isinstance(embeds, torch.Tensor): embeds = embeds.pooler_output
        embeds = embeds / embeds.norm(dim=-1, keepdim=True)
    return embeds

def clap_tags(audio_48k, processor, clap_model, tag_embeds):
    inputs = processor(audio=audio_48k, sampling_rate=CLAP_SR, return_tensors='pt')
    with torch.no_grad():
        audio_embed = clap_model.get_audio_features(**inputs)
        if not isinstance(audio_embed, torch.Tensor): audio_embed = audio_embed.pooler_output
        audio_embed = audio_embed / audio_embed.norm(dim=-1, keepdim=True)

    scores = (audio_embed @ tag_embeds.T).squeeze().numpy()
    mean   = scores.mean()
    std    = scores.std()
    return [TAGS[i]['label'] for i, s in enumerate(scores) if s > mean + 1.0 * std]

# ── Deterministic tags ────────────────────────────────────────────────────────

_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

def deterministic_tags(audio, sr):
    tags = []
    try:
        bpm = librosa.beat.tempo(y=audio, sr=sr)[0]
        if   bpm < 70:  tags.append('slow')
        elif bpm < 120: tags.append('medium tempo')
        else:           tags.append('fast')
    except Exception:
        pass
    try:
        chroma = librosa.feature.chroma_cqt(y=audio, sr=sr).mean(axis=1)
        best, key, scale = -np.inf, 'C', 'major'
        for i in range(12):
            r = np.roll(chroma, -i)
            for profile, sc in [(_MAJOR, 'major'), (_MINOR, 'minor')]:
                score = np.corrcoef(r, profile)[0, 1]
                if score > best:
                    best, key, scale = score, _NOTES[i], sc
        if best > 0.6:
            tags.append(f'{key} {scale}')
    except Exception:
        pass
    return tags

# ── Audio helpers ─────────────────────────────────────────────────────────────

def download_audio(youtube_url, output_path):
    subprocess.run([
        'yt-dlp', '--quiet', '--js-runtimes', 'node',
        '--cookies-from-browser', 'firefox:~/.zen/',
        '-x', '--audio-format', 'mp3', '--audio-quality', '0',
        '-o', str(output_path), youtube_url,
    ], check=True)

def load_segment(path, start_s, target_sr):
    duration = librosa.get_duration(path=str(path))
    offset   = min(start_s, max(0, duration - SEGMENT_S))
    audio, _ = librosa.load(str(path), sr=target_sr, mono=True,
                            offset=offset, duration=SEGMENT_S)
    return audio

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('roomId')
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--limit', type=int, default=None,
                        help='Process at most N songs')
    parser.add_argument('--download-only', action='store_true',
                        help='Only download audio, skip embedding and tagging')
    args = parser.parse_args()

    snap  = db.collection('rooms').document(args.roomId).collection('songs').stream()
    songs = [
        {'id': doc.id, **doc.to_dict()} for doc in snap
        if doc.to_dict().get('status') == 'done'
        and doc.to_dict().get('youtube_url')
        and (args.force or not doc.to_dict().get('embedding'))
    ]

    if not songs:
        print('No songs to embed — all up to date.')
        return

    if args.limit:
        songs = songs[:args.limit]

    console = Console(stderr=False)  # write to stdout, not the redirected stderr
    with Progress(
        SpinnerColumn(),
        BarColumn(),
        TaskProgressColumn(),
        TextColumn('{task.description}'),
        TimeElapsedColumn(),
        console=console,
    ) as progress:

        if not args.download_only:
            load_task = progress.add_task('[cyan]Loading MERT…', total=None)
            with silence():
                extractor, mert = load_mert()
            progress.update(load_task, description='[cyan]Loading CLAP…')
            with silence():
                clap_processor, clap_model = load_clap()
                tag_embeds = precompute_tag_embeddings(clap_processor, clap_model)
            progress.remove_task(load_task)

        overall = progress.add_task('[green]Overall', total=len(songs))
        song_t  = progress.add_task('[blue]Song', total=1 if args.download_only else 6)

        ok = fail = 0

        AUDIO_CACHE.mkdir(exist_ok=True)

        def temp_path(song):
            return AUDIO_CACHE / f'{song["id"]}.mp3'

        def download_if_needed(song):
            path = temp_path(song)
            if not path.exists():
                download_audio(song['youtube_url'], path)

        if args.download_only:
            for i, song in enumerate(songs):
                name = song.get('title', song['id'])[:50]
                progress.update(overall, description=f'[green]{name}')
                progress.reset(song_t)
                try:
                    progress.update(song_t, description='[blue]↓ downloading…')
                    download_if_needed(song)
                    progress.advance(song_t)
                    ok += 1
                except Exception as e:
                    progress.print(f'[red]  ✗ {name}: download failed: {e}')
                    fail += 1
                progress.advance(overall)
                if i + 1 < len(songs) and not temp_path(songs[i + 1]).exists():
                    delay = random.uniform(10, 20)
                    progress.update(song_t, description=f'[blue]⏳ waiting {delay:.0f}s…')
                    time.sleep(delay)

        else:
            with ThreadPoolExecutor(max_workers=1) as dl:
                next_dl = dl.submit(download_if_needed, songs[0])

                for i, song in enumerate(songs):
                    name = song.get('title', song['id'])[:50]
                    progress.update(overall, description=f'[green]{name}')
                    progress.reset(song_t)

                    progress.update(song_t, description='[blue]↓ waiting for download…')
                    try:
                        next_dl.result()
                    except Exception as e:
                        progress.print(f'[red]  ✗ {name}: download failed: {e}')
                        fail += 1
                        progress.advance(overall)
                        if i + 1 < len(songs):
                            next_dl = dl.submit(download_if_needed, songs[i+1])
                        continue

                    if i + 1 < len(songs):
                        next_dl = dl.submit(download_if_needed, songs[i+1])

                    try:
                        duration = librosa.get_duration(path=str(temp_path(song)))
                        starts   = [p * duration for p in SAMPLE_POINTS]

                        mert_embeddings = []
                        for s, start in enumerate(starts):
                            progress.update(song_t, description=f'[blue]◉ MERT segment {s+1}/4…')
                            audio_24k = load_segment(temp_path(song), start, MERT_SR)
                            mert_embeddings.append(mert_embed(audio_24k, extractor, mert))
                            progress.advance(song_t)

                        avg  = np.mean(mert_embeddings, axis=0)
                        norm = np.linalg.norm(avg)
                        embedding = (avg / norm).tolist() if norm > 0 else avg.tolist()

                        progress.update(song_t, description='[blue]✂ extracting tags…')
                        audio_48k = load_segment(temp_path(song), starts[1], CLAP_SR)
                        audio_16k = load_segment(temp_path(song), starts[1], ESSENTIA_SR)
                        with silence():
                            tags = clap_tags(audio_48k, clap_processor, clap_model, tag_embeds)
                        tags += deterministic_tags(audio_16k, ESSENTIA_SR)
                        progress.advance(song_t)

                        progress.update(song_t, description='[blue]✦ saving…')
                        db.collection('rooms').document(args.roomId) \
                          .collection('songs').document(song['id']) \
                          .update({'embedding': embedding, 'tags': tags})

                        ok += 1

                    except Exception as e:
                        progress.print(f'[red]  ✗ {name}: {e}')
                        fail += 1

                    progress.advance(overall)

    print(f'\nDone. {ok} succeeded{f", {fail} failed" if fail else ""}.')

if __name__ == '__main__':
    main()
