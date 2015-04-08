#!/bin/sh

# INFO Define variables

NAME=${NAME-"reds"}
PREFIX=${PREFIX-"/usr/local"}

BINPATH=${BINPATH-"${PREFIX}/bin"}
LIBPATH=${LIBPATH-"${PREFIX}/lib"}
ETCPATH=${ETCPATH-"${PREFIX}/etc"}
LOGPATH=${LOGPATH-"/var/log"}

BINFILE=${BINFILE-"${BINPATH}/${NAME}_pod"}
ETCFILE=${ETCFILE-"${ETCPATH}/reds/${NAME}_pod.json"}
LOGFILE=${LOGFILE-"${LOGPATH}/${NAME}_pod.log"}

POSTGRESQL_ROLE=${POSTGRESQL_ROLE-"${NAME}_pod"}
POSTGRESQL_DATABASE=${POSTGRESQL_DATABASE-"${NAME}_pod"}

# INFO Cleanup PostgreSQL database

sudo -u postgres psql -c "DROP DATABASE \"${POSTGRESQL_DATABASE}\";"
sudo -u postgres psql -c "DROP USER \"${POSTGRESQL_ROLE}\";"

# INFO Remove files

rm "${BINFILE}"
rm "${ETCFILE}"
rm "${LOGFILE}"
if [ ! `ls -A "${ETCPATH}/reds"` ]; then
    rm -r "${ETCPATH}/reds"
    rm -r "${LIBPATH}/reds"
fi
