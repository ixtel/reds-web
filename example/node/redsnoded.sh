#!/bin/bash
#
# Starts the REDS node daemon
# Usage: redsnoded [name]
#

USER="nobody"
NAME=${1-"redsnode"}
LOGFILE="/var/log/$NAME.log"
PIDFILE="/var/run/$NAME.pid"
ENV="NODE_PATH=/usr/lib/nodejs:/usr/lib/node_modules:/usr/share/javascript"

if [ -e "$PIDFILE" ]; then
	echo "deamon already started ('$PIDFILE' exists)"
	exit 1
fi

echo "`date` START" >> "$LOGFILE"
sudo -u $USER $ENV node "`dirname "$0"`/main.js" 0<&- &>> "$LOGFILE" &
echo $! > "$PIDFILE"
