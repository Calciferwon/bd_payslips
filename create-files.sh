#!/bin/bash

# Create directories
mkdir -p build

# Check if main.js exists and has content
if [ ! -s main.js ]; then
  echo "main.js is empty or doesn't exist. Creating it..."
  # You'll need to paste the main.js content here
  echo "// main.js content needs to be pasted here" > main.js
  echo "Please manually edit main.js and paste the full content"
fi

# Create other necessary files if they don't exist
touch renderer.js
touch login.html
touch index.html
touch email-template.html
touch email-validation.html
touch styles.css
touch preload.js
touch build/entitlements.mac.plist
touch build/icon.ico
touch build/icon.icns

echo "Files created. Please make sure to add the proper content to each file."
