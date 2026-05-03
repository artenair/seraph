"""
Exports laion/larger_clap_music audio and text encoders to ONNX format
for use with @xenova/transformers in Node.js.

Requirements:
    pip install "optimum[exporters,onnxruntime]" transformers torch onnx onnxruntime

Usage:
    python convert_model.py
"""

import sys
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────────────────────

for pkg in ('torch', 'transformers', 'onnx', 'onnxruntime'):
    try:
        __import__(pkg)
    except ImportError:
        print(f"Missing: {pkg}")
        print('Run: pip install "optimum[exporters,onnxruntime]" transformers torch onnx onnxruntime')
        sys.exit(1)

import torch
import numpy as np
from transformers import (
    ClapAudioModelWithProjection,
    ClapTextModelWithProjection,
    AutoFeatureExtractor,
    AutoTokenizer,
)


# ── Config ────────────────────────────────────────────────────────────────────

MODEL_ID = "laion/larger_clap_music"
OUT_DIR  = Path(__file__).parent / "larger_clap_music_onnx"
ONNX_DIR = OUT_DIR / "onnx"
ONNX_DIR.mkdir(parents=True, exist_ok=True)

# ── Load models ───────────────────────────────────────────────────────────────

print("Loading models (downloads on first run)…")
feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_ID)
tokenizer         = AutoTokenizer.from_pretrained(MODEL_ID)
audio_model       = ClapAudioModelWithProjection.from_pretrained(MODEL_ID).eval()
text_model        = ClapTextModelWithProjection.from_pretrained(MODEL_ID).eval()
print("Models loaded.\n")

# ── Save tokenizer + processor configs ───────────────────────────────────────
# transformers.js needs these alongside the ONNX files.

print("Saving configs…")
audio_model.config.save_pretrained(OUT_DIR)
feature_extractor.save_pretrained(OUT_DIR)
tokenizer.save_pretrained(OUT_DIR)

# ── Export audio model ────────────────────────────────────────────────────────

print("Exporting audio encoder…")

dummy_audio  = np.zeros(48000 * 10, dtype=np.float32)  # 10 s of silence
audio_inputs = feature_extractor(dummy_audio, sampling_rate=48000, return_tensors="pt")

# Build the ordered tuple of inputs the model forward() expects
audio_input_names = list(audio_inputs.keys())
audio_input_tuple = tuple(audio_inputs[k] for k in audio_input_names)

audio_onnx_path = ONNX_DIR / "audio_model.onnx"
with torch.no_grad():
    torch.onnx.export(
        audio_model,
        audio_input_tuple,
        str(audio_onnx_path),
        input_names=audio_input_names,
        output_names=["audio_embeds"],
        dynamic_axes={k: {0: "batch_size"} for k in audio_input_names},
        dynamo=False,
        opset_version=17,
    )
print(f"  → {audio_onnx_path}")

# ── Export text model ─────────────────────────────────────────────────────────

print("Exporting text encoder…")

dummy_text  = ["a peaceful piano music"]
text_inputs = tokenizer(dummy_text, return_tensors="pt", padding=True, truncation=True)

text_input_names = ["input_ids", "attention_mask"]
text_input_tuple = (text_inputs["input_ids"], text_inputs["attention_mask"])

text_onnx_path = ONNX_DIR / "text_model.onnx"
with torch.no_grad():
    torch.onnx.export(
        text_model,
        text_input_tuple,
        str(text_onnx_path),
        input_names=text_input_names,
        output_names=["text_embeds"],
        dynamic_axes={
            "input_ids":      {0: "batch_size", 1: "seq_len"},
            "attention_mask": {0: "batch_size", 1: "seq_len"},
        },
        dynamo=False,
        opset_version=17,
    )
print(f"  → {text_onnx_path}")

# ── Report sizes ─────────────────────────────────────────────────────────────

print("\nExport complete. File sizes:")
for p in [audio_onnx_path, text_onnx_path]:
    mb = p.stat().st_size / 1024 / 1024
    print(f"  {p.name}: {mb:.1f} MB")

# ── Done ──────────────────────────────────────────────────────────────────────

print(f"""
Done. Output: {OUT_DIR}

Next: update embed_songs.js to use the local model:

  import {{ env }} from '@xenova/transformers';
  env.localModelPath = resolve(__dir, 'larger_clap_music_onnx/');
  env.allowRemoteModels = false;

  // use '' as the model name when calling from_pretrained
  const audioModel = await ClapAudioModelWithProjection.from_pretrained('');
  const textModel  = await ClapTextModelWithProjection.from_pretrained('');
""")
