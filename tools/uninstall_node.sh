#!/bin/sh

# INFO Read the node namespace

echo "Application name"
echo
echo "Please enter the namespace of the REDS node you want to delete."
echo "The namespace value can be found in the node config file."
echo
read -p "Namespace: " NAMESPACE
echo
NAME=`expr "${NAMESPACE}" : '\([A-Za-z0-9][A-Za-z0-9-]*\)\.\([A-Za-z0-9][A-Za-z0-9-]*\)\.\([A-Za-z0-9][A-Za-z0-9-]*\)'`
if [ -z "${NAME}" ]
    echo "Invalid namespace format!"
    exit 3
fi

# INFO Define variables

PREFIX=${PREFIX-"/usr/local"}

BINPATH=${BINPATH-"${PREFIX}/bin"}
LIBPATH=${LIBPATH-"${PREFIX}/lib"}
ETCPATH=${ETCPATH-"${PREFIX}/etc"}
LOGPATH=${LOGPATH-"/var/log"}

BINFILE=${BINFILE-"${BINPATH}/${NAME}_node"}
ETCFILE=${ETCFILE-"${ETCPATH}/reds/${NAME}_node.json"}
LOGFILE=${LOGFILE-"${LOGPATH}/${NAME}_node.log"}

POSTGRESQL_ROLE=${POSTGRESQL_ROLE-"${NAME}_node"}
POSTGRESQL_DATABASE=${POSTGRESQL_DATABASE-"${NAME}_node"}

# INFO Remove files

rm "${BINFILE}"
rm "${ETCFILE}"
rm "${ETCFILE}.sample"
rm "${LOGFILE}"
if [ `ld -l "${ETCPATH}/reds/" | wc -l` -eq 0 ]
    rm -r "${LIBPATH}/reds"
    rm -r "${ETCPATH}/reds"
fi

# INFO Cleanup PostgreSQL database

sudo -u postgres psql -c "DROP DATABASE \"${POSTGRESQL_DATABASE}\";"
sudo -u postgres psql -c "DROP USER \"${POSTGRESQL_ROLE}\";"
