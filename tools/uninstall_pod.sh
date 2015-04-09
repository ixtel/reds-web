#!/bin/sh

# INFO Define variables

NAME=${NAME-"reds"}
PREFIX=${PREFIX-"/usr/local"}
RMLIB=${RMLIB-"auto"}

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

[ -f "${BINFILE}" ] && rm "${BINFILE}"
[ -f "${ETCFILE}" ] && rm "${ETCFILE}"
[ -f "${LOGFILE}" ] && rm "${LOGFILE}"

[ $RMLIB = auto ] && [ -d "${ETCPATH}/reds" ] && [ -z "`ls -A "${ETCPATH}/reds"`" ] && RMLIB=true
if [ $RMLIB = true ]; then
    [ -d "${ETCPATH}/reds" ] && rm -r "${ETCPATH}/reds"
    [ -d "${LIBPATH}/reds" ] && rm -r "${LIBPATH}/reds"
fi
