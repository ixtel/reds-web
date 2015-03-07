#!/bin/sh

PREFIX=${PREFIX-"/usr/local"}
NAME=${NAME-"reds_web"}

BINPATH=${BINPATH-"${PREFIX}/bin"}
LIBPATH=${LIBPATH-"${PREFIX}/lib"}
ETCPATH=${ETCPATH-"${PREFIX}/etc"}
LOGPATH=${LOGPATH-"/var/log"}

BINFILE_NODE=${BINFILE_NODE-"${BINPATH}/${NAME}_node"}
BINFILE_POD=${BINFILE_POD-"${BINPATH}/${NAME}_pod"}
LOGFILE_NODE=${LOGFILE_NODE-"${LOGPATH}/${NAME}_node.log"}
LOGFILE_POD=${LOGFILE_POD-"${LOGPATH}/${NAME}_pod.log"}

PGROLE=${PGROLE-"${NAME}"}
PGDATABASE_NODE=${PGDATABASE_NODE-"${NAME}_node"}
PGDATABASE_POD=${PGDATABASE_POD-"${NAME}_pod"}

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
