#!/bin/sh

coffee --watch . &
PID="$!"
supervisor -w . -p server.js
# After supervisor finishes, clean up the coffee watcher...
kill $PID
