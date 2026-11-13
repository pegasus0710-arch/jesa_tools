#!/usr/bin/env python3
"""영어회화 노트 — Azure 음성 중계 서버 (Blog J 개인용)
- 앱(https://pegasus0710-arch.github.io/jesa_tools/eng/)이 문장을 보내면 Azure 음성(MP3)을 받아 돌려줌
- Azure 키는 이 서버 환경 변수에만 둠(앱 파일에는 없음)
- 표준 라이브러리만 사용(설치할 것 없음) · 매매 서버와 따로 실행(포트 8790)
환경 변수:
  AZ_KEY      Azure Speech 키 (필수)
  AZ_REGION   예: koreacentral (필수)
  APP_KEY     앱 설정에 넣을 암호 (필수, 아무 긴 글자)
  DAY_LIMIT   하루 최대 글자 (기본 16000)
  MONTH_LIMIT 한 달 최대 글자 (기본 450000 — F0 무료 50만 자보다 조금 적게)
  PORT        기본 8790 (Caddy가 https로 받아서 넘김)
"""
import json, os, re, time, threading, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from xml.sax.saxutils import escape

AZ_KEY = os.environ.get("AZ_KEY", ""); AZ_REGION = os.environ.get("AZ_REGION", "koreacentral")
APP_KEY = os.environ.get("APP_KEY", ""); PORT = int(os.environ.get("PORT", "8790"))
DAY_LIMIT = int(os.environ.get("DAY_LIMIT", "16000")); MONTH_LIMIT = int(os.environ.get("MONTH_LIMIT", "450000"))
ORIGINS = {"https://pegasus0710-arch.github.io", "http://localhost:8792"}
VOICE_RE = re.compile(r"^(ko-KR|en-US|en-GB|en-AU)-[A-Za-z]+Neural$")
USE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tts_usage.json")
LOCK = threading.Lock()

def usage_load():
    try: return json.load(open(USE_FILE))
    except Exception: return {}
def usage_add(n):
    """글자 수 더하기 — 한도를 넘으면 False"""
    with LOCK:
        u = usage_load(); d = time.strftime("%Y-%m-%d"); m = d[:7]
        if u.get("d:" + d, 0) + n > DAY_LIMIT or u.get("m:" + m, 0) + n > MONTH_LIMIT: return False
        u["d:" + d] = u.get("d:" + d, 0) + n; u["m:" + m] = u.get("m:" + m, 0) + n
        u = {k: v for k, v in u.items() if k.startswith("m:") or k >= "d:" + time.strftime("%Y-%m-", time.localtime(time.time() - 40 * 86400))}
        json.dump(u, open(USE_FILE, "w")); return True

def azure(text, voice, rate):
    lang = voice[:5]; pct = round((rate - 1) * 100)
    ssml = (f"<speak version='1.0' xml:lang='{lang}'><voice name='{voice}'>"
            f"<prosody rate='{pct:+d}%'>{escape(text)}</prosody></voice></speak>")
    req = urllib.request.Request(f"https://{AZ_REGION}.tts.speech.microsoft.com/cognitiveservices/v1", data=ssml.encode("utf-8"), method="POST",
        headers={"Ocp-Apim-Subscription-Key": AZ_KEY, "Content-Type": "application/ssml+xml",
                 "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "bj-eng-proxy"})
    with urllib.request.urlopen(req, timeout=20) as r: return r.read()

class H(BaseHTTPRequestHandler):
    server_version = "bj-tts"
    def cors(self):
        o = self.headers.get("Origin", "")
        if o in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", o); self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-BJ-Key"); self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    def err(self, code, msg):
        b = json.dumps({"error": msg}, ensure_ascii=False).encode()
        self.send_response(code); self.cors(); self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.send_header("Access-Control-Max-Age", "86400"); self.end_headers()
    def do_GET(self):
        if self.path == "/health":
            u = usage_load(); d = time.strftime("%Y-%m-%d")
            return self.err(200, f"ok · 오늘 {u.get('d:'+d,0)}자 · 이번 달 {u.get('m:'+d[:7],0)}자")
        self.err(404, "없는 주소")
    def do_POST(self):
        if self.path != "/tts": return self.err(404, "없는 주소")
        if self.headers.get("Origin", "") not in ORIGINS: return self.err(403, "허용되지 않은 곳")
        if not APP_KEY or self.headers.get("X-BJ-Key", "") != APP_KEY: return self.err(401, "앱 암호가 달라요")
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n > 4000: return self.err(413, "너무 길어요")
            j = json.loads(self.rfile.read(n) or b"{}")
            text = str(j.get("text", "")).strip(); voice = str(j.get("voice", "")); rate = float(j.get("rate", 1))
        except Exception: return self.err(400, "잘못된 요청")
        if not text or len(text) > 400: return self.err(400, "문장은 1~400자")
        if not VOICE_RE.match(voice): return self.err(400, "목소리 이름 확인")
        rate = min(1.5, max(0.6, rate))
        cost = len(text) + len(re.findall(r"[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3\u4e00-\u9fff]", text))  # 한글 · 한자는 2자로 셈(안전하게)
        if not usage_add(cost): return self.err(429, "오늘(또는 이번 달) 한도를 넘었어요")
        try: audio = azure(text, voice, rate)
        except urllib.error.HTTPError as e: return self.err(502, f"Azure 오류 {e.code}")
        except Exception as e: return self.err(502, "Azure 연결 실패")
        self.send_response(200); self.cors(); self.send_header("Content-Type", "audio/mpeg"); self.send_header("Content-Length", str(len(audio))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(audio)
    def log_message(self, f, *a):  # 문장 내용은 기록하지 않음
        pass

if __name__ == "__main__":
    if not (AZ_KEY and APP_KEY): raise SystemExit("AZ_KEY · APP_KEY 환경 변수를 넣어 주세요")
    print(f"bj-tts 시작 — 127.0.0.1:{PORT} · {AZ_REGION} · 하루 {DAY_LIMIT}자 · 한 달 {MONTH_LIMIT}자")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
