import os
import torch
import librosa
import noisereduce as nr
import joblib
from speechbrain.pretrained import EncoderClassifier

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
encoder = EncoderClassifier.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    run_opts={"device": device}
)
encoder.eval()

def preprocess_audio(path):
    y, sr = librosa.load(path, sr=16000, mono=True)
    y = nr.reduce_noise(y=y, sr=sr)
    y = librosa.util.normalize(y)
    rms = (y**2).mean()**0.5
    if rms < 0.02:
        y *= (0.03 / rms)
    return y

def extract_embedding(path):
    y = preprocess_audio(path)
    sig = torch.from_numpy(y).unsqueeze(0).to(device)
    emb = encoder.encode_batch(sig)[0].cpu().numpy()
    return emb

def enroll_speakers(data_dir="data", out_file="speaker_db.pkl"):
    speaker_db = {}
    for speaker in os.listdir(data_dir):
        sp_path = os.path.join(data_dir, speaker)
        if not os.path.isdir(sp_path):
            continue
        embeddings = []
        for file in os.listdir(sp_path):
            if file.endswith(".wav"):
                try:
                    emb = extract_embedding(os.path.join(sp_path, file))
                    embeddings.append(emb)
                except:
                    continue
        if embeddings:
            speaker_db[speaker] = embeddings  # store all embeddings
            print(f"{speaker}: {len(embeddings)} clips enrolled")
    joblib.dump(speaker_db, out_file)
    print("Speaker DB saved to", out_file)

if __name__ == "__main__":
    enroll_speakers()
