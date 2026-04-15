#!/usr/bin/env python3
import os
import shutil
from pathlib import Path

source_dir = Path("/vercel/share/v0-project/oji-ai-gate-main")
target_dir = Path("/vercel/share/v0-project")

if source_dir.exists():
    # List all items in source directory
    for item in source_dir.iterdir():
        source_path = item
        target_path = target_dir / item.name
        
        try:
            if source_path.is_dir():
                # Remove target if it exists
                if target_path.exists():
                    shutil.rmtree(target_path)
                # Copy directory
                shutil.copytree(source_path, target_path)
                print(f"✓ Copied directory: {item.name}")
            else:
                # Copy file
                if target_path.exists():
                    target_path.unlink()
                shutil.copy2(source_path, target_path)
                print(f"✓ Copied file: {item.name}")
        except Exception as e:
            print(f"✗ Error moving {item.name}: {e}")
    
    # Remove source directory
    try:
        shutil.rmtree(source_dir)
        print(f"\n✓ Removed empty source directory: oji-ai-gate-main")
    except Exception as e:
        print(f"✗ Error removing source directory: {e}")
else:
    print("Source directory not found!")
