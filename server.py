from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import tempfile
import os
import time

app = Flask(__name__)
CORS(app)

@app.route('/identify', methods=['POST'])
def identify():
    audio_file = request.files['audio']

    # Save uploaded audio to a temporary WAV file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        # Run the speaker recognition script
        result = subprocess.check_output(
            ["python", "voice_model/recognize_speaker.py", tmp_path],
            stderr=subprocess.STDOUT,
            text=True
        ).strip()

        print("Recognition output:", result)

        # Extract final speaker line
        speaker = result.splitlines()[-1]
        return jsonify({"speaker": speaker})

    except subprocess.CalledProcessError as e:
        print("Error during recognition:\n", e.output)
        return jsonify({"speaker": "error"}), 500

    finally:
        # Delay file cleanup to avoid Windows file lock
        time.sleep(0.5)
        try:
            os.remove(tmp_path)
        except PermissionError:
            print("Skipped deletion (file in use):", tmp_path)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
