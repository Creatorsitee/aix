import os
import shutil
from pathlib import Path

source_folder = Path('/vercel/share/v0-project/oji-ai-gate-main')
root_folder = Path('/vercel/share/v0-project')

# List of directories and files to move
items_to_move = ['src', 'public', '.gitignore']

for item in items_to_move:
    source_path = source_folder / item
    dest_path = root_folder / item
    
    if source_path.exists():
        if source_path.is_dir():
            # Remove destination if exists
            if dest_path.exists():
                shutil.rmtree(dest_path)
            # Move directory
            shutil.copytree(source_path, dest_path)
            shutil.rmtree(source_path)
            print(f"✓ Moved directory: {item}")
        else:
            # Move file
            if dest_path.exists():
                dest_path.unlink()
            shutil.copy2(source_path, dest_path)
            source_path.unlink()
            print(f"✓ Moved file: {item}")
    else:
        print(f"⚠ Not found: {item}")

# Remove empty oji-ai-gate-main folder if it's empty
try:
    if source_folder.exists():
        os.rmdir(source_folder)
        print(f"✓ Removed empty folder: oji-ai-gate-main")
except OSError:
    print(f"⚠ Could not remove oji-ai-gate-main folder (not empty or permission issue)")

print("\nReorganization complete!")
