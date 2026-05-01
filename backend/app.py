import os
import tempfile
import shutil
from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
from yt_dlp import YoutubeDL

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route("/api/inspect", methods=["POST"])
def inspect_video():
    data = request.get_json(force=True, silent=True)
    if not data or "url" not in data:
        return jsonify({"success": False, "message": "Video URL is required."}), 400

    url = data["url"].strip()
    if not url:
        return jsonify({"success": False, "message": "Video URL cannot be empty."}), 400

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "no_warnings": True,
        "format": "best",
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        formats = []
        for fmt in info.get("formats", []):
            if not fmt.get("format_id"):
                continue

            raw_filesize = fmt.get("filesize")
            raw_approx = fmt.get("filesize_approx")
            filesize = raw_filesize if raw_filesize is not None else raw_approx
            if raw_filesize and raw_approx and raw_filesize > raw_approx * 4:
                filesize = raw_approx

            formats.append({
                "format_id": fmt.get("format_id"),
                "ext": fmt.get("ext"),
                "resolution": fmt.get("resolution") or fmt.get("height") or fmt.get("format_note"),
                "format_note": fmt.get("format_note"),
                "filesize": filesize,
                "filesize_approx": raw_approx,
                "fps": fmt.get("fps"),
                "protocol": fmt.get("protocol"),
                "tbr": fmt.get("tbr"),
                "acodec": fmt.get("acodec"),
                "vcodec": fmt.get("vcodec"),
            })

        return jsonify({
            "success": True,
            "title": info.get("title"),
            "uploader": info.get("uploader"),
            "duration": info.get("duration"),
            "view_count": info.get("view_count"),
            "thumbnail": info.get("thumbnail"),
            "formats": formats,
        })
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


def get_format_entry(info, format_id):
    for fmt in info.get("formats", []):
        if fmt.get("format_id") == format_id:
            return fmt
    return None


@app.route("/api/download-url", methods=["POST"])
def download_url():
    data = request.get_json(force=True, silent=True)
    if not data or "url" not in data or "format_id" not in data:
        return jsonify({"success": False, "message": "Both url and format_id are required."}), 400

    url = data["url"].strip()
    format_id = data["format_id"].strip()

    if not url or not format_id:
        return jsonify({"success": False, "message": "Both url and format_id are required."}), 400

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "no_warnings": True,
        "format": format_id,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            fmt = get_format_entry(info, format_id)
            if not fmt or not fmt.get("url"):
                return jsonify({"success": False, "message": "Unable to resolve direct download URL for this format."}), 500

            return jsonify({
                "success": True,
                "download_url": fmt.get("url"),
                "filename": ydl.prepare_filename(info),
            })
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/download", methods=["GET"])
def download_video():
    url = request.args.get("url", "").strip()
    format_id = request.args.get("format_id", "").strip()

    if not url or not format_id:
        return jsonify({"success": False, "message": "Both url and format_id are required."}), 400

    temp_dir = tempfile.mkdtemp(prefix="video_download_")
    outtmpl = os.path.join(temp_dir, "%(title)s.%(ext)s")
    ydl_opts = {
        "format": format_id,
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

        if not os.path.exists(filename):
            return jsonify({"success": False, "message": "Download failed or file not found."}), 500

        @after_this_request
        def cleanup(response):
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass
            return response

        return send_file(
            filename,
            as_attachment=True,
            download_name=os.path.basename(filename),
        )
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
