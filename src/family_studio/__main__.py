import argparse

import uvicorn

from .app import create_app

parser = argparse.ArgumentParser(description="Run Family Studio alongside Open WebUI")
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", default=5030, type=int)
args = parser.parse_args()
uvicorn.run(create_app(), host=args.host, port=args.port, access_log=False)
