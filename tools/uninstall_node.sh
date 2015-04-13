#!/bin/sh

# INFO Read the node namespace

if [ -z "${NAMESPACE}" ]; then
    echo "Application namespace"
    echo
    echo "Please enter the namespace of the REDS node you want to delete."
    echo "The namespace value can be found in the node config file."
    echo
    read -p "Namespace: " NAMESPACE
    echo
fi
NAME=`expr "${NAMESPACE}" : '[A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9-]*\.\([A-Za-z0-9][A-Za-z0-9-]*\)'`
if [ -z "${NAME}" ]; then
    echo "Invalid namespace format!"
    exit 3
fi

# INFO Define variables

[ -z "$PREFIX" ] && PREFIX="/usr/local"
[ -z "$RMLIB" ] && RMLIB="auto"

[ -z "$BINPATH" ] && BINPATH="${PREFIX}/bin"
[ -z "$LIBPATH" ] && LIBPATH="${PREFIX}/lib"
[ -z "$ETCPATH" ] && ETCPATH="${PREFIX}/etc"
[ -z "$LOGPATH" ] && LOGPATH="/var/log"

[ -z "$BINFILE" ] && BINFILE="${BINPATH}/${NAME}_node"
[ -z "$ETCFILE" ] && ETCFILE="${ETCPATH}/reds/${NAME}_node.json"
[ -z "$LOGFILE" ] && LOGFILE="${LOGPATH}/${NAME}_node.log"

[ -z "$POSTGRESQL_ROLE" ] && POSTGRESQL_ROLE="${NAME}_node"
[ -z "$POSTGRESQL_DATABASE" ] && POSTGRESQL_DATABASE="${NAME}_node"

# INFO Normalize PREFIX

PREFIX="`CDPATH="" cd "$PREFIX" && pwd`"

# INFO Cleanup PostgreSQL database

sudo -u postgres psql -c "DROP DATABASE \"${POSTGRESQL_DATABASE}\";"
sudo -u postgres psql -c "DROP USER \"${POSTGRESQL_ROLE}\";"

# INFO Remove files

[ -f "${BINFILE}" ] && rm -f "${BINFILE}"
[ -f "${ETCFILE}" ] && rm -f "${ETCFILE}"
[ -f "${ETCFILE}.sample" ] && rm -f "${ETCFILE}.sample"
[ -f "${LOGFILE}" ] && rm "${LOGFILE}"

[ $RMLIB = auto ] && [ -d "${ETCPATH}/reds" ] && [ -z "`ls -A "${ETCPATH}/reds"`" ] && RMLIB=true
if [ $RMLIB = true ]; then
    [ -d "${ETCPATH}/reds" ] && rm -rf "${ETCPATH}/reds"
    [ -d "${LIBPATH}/reds" ] && rm -rf "${LIBPATH}/reds"
fi