import os
import sys

# Add root backend directory and src/ to sys.path so modules and routers are resolved
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)

if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

src_dir = os.path.join(parent_dir, "src")
if os.path.exists(src_dir) and src_dir not in sys.path:
    sys.path.insert(0, src_dir)

# Import the FastAPI application
from backend import app

# Export app for Vercel Serverless Functions
app = app
