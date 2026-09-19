from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yaml
import os
from pathlib import Path

# Setup router
router = APIRouter(prefix="/api/targets", tags=["targets"])

# Re-establish constants from main backend (in a real app, these go to config.py)
root_dir = Path(__file__).resolve().parent.parent
_TEMP_PREFIX = "temp_ui_"

class SaveTargetRequest(BaseModel):
    content: str

@router.get("/")
def get_targets():
    targets_dir = root_dir / "targets"
    if not targets_dir.is_dir():
        return {"targets": []}
    files = []
    for f in targets_dir.iterdir():
        if f.is_file() and f.suffix in (".yaml", ".yml") and not f.name.startswith(_TEMP_PREFIX):
            files.append({
                "name": f.name,
                "path": str(f.resolve())
            })
    return {"targets": files}

@router.get("/{name}")
def get_target_content(name: str):
    targets_dir = root_dir / "targets"
    target_path = (targets_dir / name).resolve()
    if not target_path.is_relative_to(targets_dir.resolve()):
        raise HTTPException(status_code=400, detail="invalid target name")
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail="Target file not found")
    return {"content": target_path.read_text(encoding="utf-8")}

@router.post("/{name}")
def save_target(name: str, req: SaveTargetRequest):
    if not (name.endswith(".yaml") or name.endswith(".yml")):
        raise HTTPException(status_code=400, detail="Filename must end with .yaml or .yml")
    if name.startswith(_TEMP_PREFIX):
        raise HTTPException(status_code=400, detail="Cannot save to temporary filename prefix")
    targets_dir = root_dir / "targets"
    targets_dir.mkdir(parents=True, exist_ok=True)
    target_path = (targets_dir / name).resolve()
    if not target_path.is_relative_to(targets_dir.resolve()):
        raise HTTPException(status_code=400, detail="invalid target name")
    try:
        yaml.safe_load(req.content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML content: {str(e)}")
    target_path.write_text(req.content, encoding="utf-8")
    return {"message": "Target saved successfully", "name": name, "path": str(target_path)}

@router.delete("/{name}")
def delete_target(name: str):
    targets_dir = root_dir / "targets"
    target_path = (targets_dir / name).resolve()
    if not target_path.is_relative_to(targets_dir.resolve()):
        raise HTTPException(status_code=400, detail="invalid target name")
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail="Target file not found")
    try:
        os.remove(target_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Target deleted successfully"}
