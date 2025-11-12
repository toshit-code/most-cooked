import sys
import torch
import numpy as np
import joblib
import librosa
import noisereduce as nr
from speechbrain.inference.speaker import EncoderClassifier
import warnings
warnings.filterwarnings('ignore')

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
encoder = EncoderClassifier.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    run_opts={"device": device}
)
encoder.eval()

def extract_embedding(file_path):
    try:
        y, sr = librosa.load(file_path, sr=16000, mono=True)
        y = nr.reduce_noise(y=y, sr=sr)
        y = librosa.util.normalize(y)
        sig = torch.from_numpy(y).unsqueeze(0).to(device)
        embedding = encoder.encode_batch(sig)[0].cpu().numpy()
        return embedding
    except Exception as e:
        print("Error:", e)
        return None

def predict_speaker(file_path, model_path="speaker_model.pkl", conf_threshold=0.7, diff_threshold=0.3):
    data = joblib.load(model_path)
    pipeline = data['pipeline']
    label_encoder = data['label_encoder']

    emb = extract_embedding(file_path)
    if emb is None:
        return "unknown"
    probs = pipeline.predict_proba(emb.reshape(1, -1))[0]
    idx = np.argmax(probs)
    confidence = probs[idx]
    speaker = label_encoder.inverse_transform([idx])[0]

    print("Predicted:", speaker)
    print("Confidence:", confidence)
    for sp, p in zip(label_encoder.classes_, probs):
        print(f"  {sp}: {p:.3f}")

    sorted_probs = np.sort(probs)[::-1]
    if confidence < conf_threshold:
        print("Low confidence; returning unknown")
        return "unknown"
    if len(sorted_probs) > 1 and (sorted_probs[0] - sorted_probs[1]) < diff_threshold:
        print("Ambiguous; returning unknown")
        return "unknown"

    return speaker

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python recogniser_embeddings.py <audio_file>")
        sys.exit(1)
    result = predict_speaker(sys.argv[1])
    print("FINAL RESULT:", result)
