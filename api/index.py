import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(root_dir, "backend")
src_dir = os.path.join(backend_dir, "src")

# Prepend paths to sys.path
for path in [backend_dir, root_dir, src_dir]:
    if os.path.exists(path) and path not in sys.path:
        sys.path.insert(0, path)

try:
    from backend import app
except (ImportError, ModuleNotFoundError):
    from backend.backend import app

# Export app and handler for Vercel
app = app
handler = app
