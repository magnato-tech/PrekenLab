"""
TaleLab Open Source AI Voice Backend
Uses Resemble AI's Chatterbox Multilingual (MIT License) for zero-shot voice cloning and Norwegian TTS.
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

app = FastAPI(
    title="TaleLab Open Voice Backend",
    description="Åpen stemmeklonings-backend basert på Resemble AI Chatterbox Multilingual",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
REFERENCES_DIR = BASE_DIR / "references"
OUTPUTS_DIR = BASE_DIR / "outputs"
PROFILES_FILE = BASE_DIR / "profiles.json"

REFERENCES_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# Global model handle
model_instance = None
model_load_error = None
device_name = "cpu"

def check_hardware_and_load_model():
    """Detects CUDA/GPU and attempts to load ChatterboxMultilingualTTS."""
    global model_instance, model_load_error, device_name

    try:
        import torch
        if torch.cuda.is_available():
            device_name = f"cuda ({torch.cuda.get_device_name(0)})"
            chosen_device = "cuda"
        else:
            device_name = "cpu"
            chosen_device = "cpu"

        # Attempt import of chatterbox
        try:
            from chatterbox.tts import ChatterboxMultilingualTTS  # type: ignore
            print(f"[TaleLab] Laster ChatterboxMultilingualTTS på {chosen_device}...")
            model_instance = ChatterboxMultilingualTTS.from_pretrained(device=chosen_device)
            print("[TaleLab] Chatterbox-modell er vellykket lastet inn!")
        except ImportError:
            try:
                from chatterbox.tts import ChatterboxTTS  # type: ignore
                print(f"[TaleLab] Laster ChatterboxTTS på {chosen_device}...")
                model_instance = ChatterboxTTS.from_pretrained(device=chosen_device)
                print("[TaleLab] ChatterboxTTS modell er lastet inn!")
            except Exception as e:
                model_load_error = f"Kunne ikke importere eller laste Chatterbox: {str(e)}"
                print(f"[TaleLab Advarsel] {model_load_error}")
    except Exception as e:
        model_load_error = f"PyTorch / Maskinvarefeil: {str(e)}"
        print(f"[TaleLab Feil] {model_load_error}")

# Run model detection on startup
check_hardware_and_load_model()


class SynthesisRequest(BaseModel):
    text: str
    reference_id: str
    language: str = "no"
    exaggeration: float = 0.5  # 0.0 - 1.0 (Chatterbox emotional expressiveness)
    cfg_weight: float = 0.5    # 0.0 - 1.0 (Classifier-free guidance pacing)


class VoiceProfileCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    dialect: Optional[str] = "Bokmål"
    reference_ids: List[str]


@app.get("/health")
def health():
    """Returns real backend status, model state, and hardware details."""
    has_torch = "torch" in sys.modules
    vram_info = None

    if has_torch:
        import torch
        if torch.cuda.is_available():
            free_vram = torch.cuda.mem_get_info()[0] / (1024 ** 3)
            total_vram = torch.cuda.mem_get_info()[1] / (1024 ** 3)
            vram_info = f"{free_vram:.1f} GB ledig / {total_vram:.1f} GB totalt"

    return {
        "status": "online",
        "provider": "Resemble AI Chatterbox (Åpen kildekode)",
        "model": "resemble-ai/chatterbox-multilingual",
        "license": "MIT",
        "device": device_name,
        "model_loaded": model_instance is not None,
        "load_error": model_load_error,
        "vram": vram_info,
        "supported_languages": ["no", "en", "de", "fr", "es", "it", "sv", "da"],
        "default_language": "no",
    }


@app.post("/upload-reference")
async def upload_reference(file: UploadFile = File(...)):
    """Saves user's uploaded MP3 sermon recording as a reference for voice cloning."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Mangler filnavn.")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".mp3", ".wav", ".m4a", ".aac", ".ogg"]:
        raise HTTPException(status_code=400, detail="Ugyldig format. Støtter MP3, WAV og M4A.")

    clean_id = f"ref_{Path(file.filename).stem}_{os.urandom(4).hex()}{ext}"
    dest_path = REFERENCES_DIR / clean_id

    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Convert to standard 24kHz / 16kHz WAV for Chatterbox if needed
    wav_path = dest_path.with_suffix(".wav")
    if ext != ".wav":
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(dest_path), "-ar", "24000", "-ac", "1", str(wav_path)],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except Exception as e:
            print(f"[FFmpeg Advarsel] Kunne ikke konvertere til WAV: {e}")

    # Calculate duration
    duration = 0.0
    try:
        import soundfile as sf
        info = sf.info(str(wav_path if wav_path.exists() else dest_path))
        duration = round(info.duration, 2)
    except Exception:
        pass

    return {
        "id": clean_id,
        "filename": file.filename,
        "size_bytes": dest_path.stat().st_size,
        "duration_seconds": duration,
        "wav_ready": wav_path.exists(),
    }


@app.get("/references")
def list_references():
    """Lists all stored reference audio files."""
    results = []
    for f in REFERENCES_DIR.glob("*"):
        if f.suffix in [".mp3", ".wav", ".m4a"]:
            results.append({
                "id": f.name,
                "name": f.name,
                "size": f.stat().st_size,
            })
    return results


@app.post("/synthesize")
async def synthesize(req: SynthesisRequest):
    """
    Synthesizes Norwegian text using the specified reference audio clip
    with Chatterbox Multilingual zero-shot voice cloning.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Tekst for opplesning kan ikke være tom.")

    # Find the reference audio file
    target_ref = REFERENCES_DIR / req.reference_id
    if not target_ref.exists():
        # Check if a .wav version exists
        wav_cand = REFERENCES_DIR / f"{Path(req.reference_id).stem}.wav"
        if wav_cand.exists():
            target_ref = wav_cand
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Referanselydfil «{req.reference_id}» ble ikke funnet på serveren."
            )

    output_wav = OUTPUTS_DIR / f"speech_{os.urandom(6).hex()}.wav"
    output_mp3 = output_wav.with_suffix(".mp3")

    if model_instance is None:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Chatterbox-modellen er ikke ferdig initialisert på denne serveren. "
                f"Årsak: {model_load_error or 'Vekter ikke lastet inn'}. "
                f"Start modellen på en maskin med støttet GPU eller CPU og kjør backend/run.sh."
            ),
        )

    try:
        # Run inference using Chatterbox API
        print(f"[TaleLab] Genererer tale for tekst ({len(req.text)} tegn) med referanse {target_ref}...")
        
        # ChatterboxMultilingualTTS.generate(text, audio_prompt_path, exaggeration, cfg)
        import torchaudio  # type: ignore
        wav_tensor = model_instance.generate(
            text=req.text.strip(),
            audio_prompt_path=str(target_ref),
            exaggeration=req.exaggeration,
            cfg=req.cfg_weight,
        )

        sample_rate = getattr(model_instance, "sample_rate", 24000)
        torchaudio.save(str(output_wav), wav_tensor.cpu(), sample_rate)

        # Convert to MP3 using ffmpeg
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(output_wav), "-b:a", "192k", str(output_mp3)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        final_path = output_mp3 if output_mp3.exists() else output_wav
        return FileResponse(
            path=str(final_path),
            media_type="audio/mpeg" if final_path.suffix == ".mp3" else "audio/wav",
            filename=f"talelab-preken-{req.reference_id}.mp3",
        )

    except Exception as e:
        print(f"[TaleLab Genereringsfeil] {e}")
        raise HTTPException(status_code=500, detail=f"Feil under modellkjøring: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
