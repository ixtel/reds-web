#!/bin/sh

NAME="reds_web"
PREFIX="/usr/local"

BINPATH="${PREFIX}/bin"
LIBPATH="${PREFIX}/lib"
ETCPATH="${PREFIX}/etc"
LOGPATH="/var/log"

BINFILE_NODE="${BINPATH}/${NAME}_node"
BINFILE_POD="${BINPATH}/${NAME}_pod"
LOGFILE_NODE="${LOGPATH}/${NAME}_node.log"
LOGFILE_POD="${LOGPATH}/${NAME}_pod.log"

PGROLE="${NAME}"
PGDATABASE_NODE="${NAME}_node"
PGDATABASE_POD="${NAME}_pod"

# INFO Remove files

rm -r "${LIBPATH}/reds"
rm -r "${ETCPATH}/reds"
rm "${BINFILE_NODE}"
rm "${BINFILE_POD}"
rm "${LOGFILE_NODE}"
rm "${LOGFILE_POD}"

#INFO Cleanup PostgreSQL

sudo -u postgres psql -c "DROP DATABASE \"${PGDATABASE_NODE}\";"
sudo -u postgres psql -c "DROP DATABASE \"${PGDATABASE_POD}\";"
sudo -u postgres psql -c "DROP USER \"${PGROLE}\";"
