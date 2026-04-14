#!/bin/bash
cat "$(dirname "$0")/apps-script/Code.gs" | pbcopy
echo "Code.gs copied to clipboard — paste into Apps Script editor."
