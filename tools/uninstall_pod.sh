#!/bin/sh

# INFO Define variables

[ -z "$NAME" ] && NAME="reds"
[ -z "$PREFIX" ] && PREFIX="/usr/local"
[ -z "$RMLIB" ] && RMLIB="auto"

[ -z "$BINPATH" ] && BINPATH="${PREFIX}/bin"
[ -z "$LIBPATH" ] && LIBPATH="${PREFIX}/lib"
[ -z "$ETCPATH" ] && ETCPATH="${PREFIX}/etc"
[ -z "$LOGPATH" ] && LOGPATH="/var/log"

[ -z "$BINFILE" ] && BINFILE="${BINPATH}/${NAME}_pod"
[ -z "$ETCFILE" ] && ETCFILE="${ETCPATH}/reds/${NAME}_pod.json"
[ -z "$LOGFILE" ] && LOGFILE="${LOGPATH}/${NAME}_pod.log"

[ -z "$POSTGRESQL_ROLE" ] && POSTGRESQL_ROLE="${NAME}_pod"
[ -z "$POSTGRESQL_DATABASE" ] && POSTGRESQL_DATABASE="${NAME}_pod"

# INFO Normalize PREFIX

PREFIX="`CDPATH="" cd "$PREFIX" && pwd`"

# INFO Cleanup PostgreSQL database

sudo -u postgres psql -c "DROP DATABASE \"${POSTGRESQL_DATABASE}\";"
sudo -u postgres psql -c "DROP USER \"${POSTGRESQL_ROLE}\";"

# INFO Remove files

[ -f "${BINFILE}" ] && rm -f "${BINFILE}"
[ -f "${ETCFILE}" ] && rm -f "${ETCFILE}"
[ -f "${LOGFILE}" ] && rm "${LOGFILE}"
[ -d "${ETCPATH}/reds" ] && [ -z "`ls -A "${ETCPATH}/reds"`" ] && rm -rf "${ETCPATH}/reds" 

# INFO Remove library

if [ $RMLIB = "auto" ]; then
    RMLIB=false
    [ -d "${ETCPATH}/reds" ] && [ -z "`ls -A "${ETCPATH}/reds/*_node.json"`" ] && [ -z "`ls -A "${ETCPATH}/reds/*_pod.json"`" ] && RMLIB=true
fi
[ $RMLIB = true ] && [ -d "${LIBPATH}/reds" ] && rm -rf "${LIBPATH}/reds"
