#!/bin/bash

# Move all files from oji-ai-gate-main to root
cd /vercel/share/v0-project

# Copy all files except the folder itself
find oji-ai-gate-main -mindepth 1 -maxdepth 1 -type f -exec cp {} . \;
find oji-ai-gate-main -mindepth 1 -maxdepth 1 -type d ! -name "oji-ai-gate-main" -exec cp -r {} . \;

# Remove the source folder
rm -rf oji-ai-gate-main

echo "Files reorganized successfully!"
