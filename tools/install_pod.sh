#!/bin/sh

# INFO Detect Node.js binary

if [ -z ${NODEBIN} ]; then
    NODEBIN=`which nodejs`
    if [ -z "${NODEBIN}" ]; then
        NODEBIN=`which node`
    fi
fi
if [ ! -x "${NODEBIN}" ]; then
    echo "Node.js binary not executable!"
    exit 2
fi

# INFO Detect git binary (or fallbacks)

[ -z "$GITBIN" ] && GITBIN=`which git`
if [ ! -x "${GITBIN}" ]; then
    echo -n "Git binary not executable - trying to find fallback... "
    [ -z "$CURLBIN" ] && CURLBIN=`which curl`
    if [ ! -x "${CURLBIN}" ]; then
        echo "Curl binary not executable!"
        exit 3
    fi
    [ -z "$TARBIN" ] && TARBIN=`which tar`
    if [ ! -x "${TARBIN}" ]; then
        echo "Tar binary not executable!"
        exit 3
    fi
    echo "found."
fi

#INFO Detech openssl binary (or fallback)

[ -z "$OSSLBIN" ] && OSSLBIN=`which openssl`
if [ ! -x "${OSSLBIN}" ]; then
    echo -n "OpenSSL binary not executable - trying to find fallback... "
    [ -z "$B64BIN" ] && B64BIN=`which base64`
    if [ ! -x "${B64BIN}" ]; then
        echo "Base64 binary not executable!"
        exit 3
    fi
    echo "found."
fi

# INFO Read pod password

if [ -z "${PASSWORD}" ]; then
    echo "Pod password"
    echo
    echo "The pod password prevents others from using your pod to store their data on it."
    echo "Apart from that it also ensures thay you're really using your pod to store your"
    echo "data. The pod password is not required to share data on your pod with others."
    echo
    stty -echo
    read -p "Password: " PASSWORD
    echo
    read -p "Confirmation: " CONFIRMATION
    echo
    echo
    stty echo
    if [ "${PASSWORD}" != "${CONFIRMATION}" ]; then
        echo "The password and confirmation mismatch!"
        exit 1
    fi
fi

# INFO Define variables

[ -z "$NAME" ] && NAME="reds"
[ -z "$PREFIX" ] && PREFIX="/usr/local"
[ -z "$BRANCH" ] && BRANCH="master"
if [ ${OSSLBIN} ]; then
    [ -z "$SALT" ] && SALT=`cat /dev/urandom | head -c 32 | ${OSSLBIN} base64`
else
    [ -z "$SALT" ] && SALT=`cat /dev/urandom | head -c 32 | ${B64BIN}`
fi

[ -z "$BINPATH" ] && BINPATH="${PREFIX}/bin"
[ -z "$LIBPATH" ] && LIBPATH="${PREFIX}/lib"
[ -z "$ETCPATH" ] && ETCPATH="${PREFIX}/etc"
[ -z "$LOGPATH" ] && LOGPATH="/var/log"
[ -z "$TMPPATH" ] && TMPPATH="/tmp"

[ -z "$BINFILE" ] && BINFILE="${BINPATH}/${NAME}_pod"
[ -z "$ETCFILE" ] && ETCFILE="${ETCPATH}/reds/${NAME}_pod.json"
[ -z "$LOGFILE" ] && LOGFILE="${LOGPATH}/${NAME}_pod.log"

[ -z "$POSTGRESQL_ROLE" ] && POSTGRESQL_ROLE="${NAME}_pod"
[ -z "$POSTGRESQL_PASSWORD" ] && POSTGRESQL_PASSWORD=`cat /dev/urandom | LC_CTYPE=C tr -dc "A-Za-z0-9-_" | head -c 22`
[ -z "$POSTGRESQL_DATABASE" ] && POSTGRESQL_DATABASE="${NAME}_pod"

# INFO Normalize PREFIX

PREFIX="`CDPATH="" cd "$PREFIX" && pwd`"

# INFO Create required paths

mkdir -p "${BINPATH}"
mkdir -p "${LIBPATH}"
mkdir -p "${ETCPATH}/reds"
mkdir -p "${LOGPATH}"
mkdir -p "${TMPPATH}"

# INFO Download and install REDS library

if [ ! -e "${LIBPATH}/reds" ]; then
    if [ ${GITBIN} ]; then
        "${GITBIN}" clone -b ${BRANCH} https://github.com/flowyapps/reds-web "${LIBPATH}/reds"
    else 
        "$CURLBIN" "https://codeload.github.com/flowyapps/reds-web/tar.gz/${BRANCH}" -o "${TMPPATH}/reds-web-${BRANCH}.tar.gz"
        tar xfz "${TMPPATH}/reds-web-${BRANCH}.tar.gz" -C "${TMPPATH}"
        mv "${TMPPATH}/reds-web-${BRANCH}" "${LIBPATH}/reds"
        rm "${TMPPATH}/reds-web-${BRANCH}.tar.gz"
    fi
fi

# INFO Create config files

if [ ! -e "${ETCFILE}" ]; then
    echo "{
    \"host\": null,
    \"port\": 5614,
    \"user\": \"nobody\",
    \"group\": \"nogroup\",
    \"workers\": 1,
    \"log\": \"info\",
    \"salt\": \"${SALT}\",
    \"password\": \"${PASSWORD}\",
    \"crypto\": [
        \"256_AES128-CTR_SHA256_PBKDF2-HMAC-SHA256_SECP256K1-1\"
    ],
    \"storage\": {
        \"name\": \"POSTGRESQL\",
        \"options\": {
            \"connect\": \"postgres://${POSTGRESQL_ROLE}:${POSTGRESQL_PASSWORD}@localhost/${POSTGRESQL_DATABASE}\"
        }
    }
}" > "${ETCFILE}"
fi

# INFO Create start scripts

if [ ! -e "${BINFILE}" ]; then
    echo "#!${NODEBIN}
var PodServer = require(\"${LIBPATH}/reds/pod/Server\");
var server = new PodServer(\"${ETCFILE}\");
server.run();" > "${BINFILE}"
    chmod a+x "${BINFILE}"
fi

# INFO Setup PostgreSQL database

su postgres -c "psql -c \"CREATE USER \\\"${POSTGRESQL_ROLE}\\\" WITH PASSWORD '${POSTGRESQL_PASSWORD}';\""
su postgres -c "psql -c \"CREATE DATABASE \\\"${POSTGRESQL_DATABASE}\\\" WITH TEMPLATE = template0 OWNER = \\\"${POSTGRESQL_ROLE}\\\";\""
su postgres -c "psql -d ${POSTGRESQL_DATABASE} -f \"${LIBPATH}/reds/shared/storage/postgresql/pod.sql\""
su postgres -c "psql -d ${POSTGRESQL_DATABASE} -c \"ALTER TABLE public.nodes OWNER TO \\\"${POSTGRESQL_ROLE}\\\";\""
# NOTE The typecasting workaround for update entity calls requires automatic typecasting from integer to boolean.
#      This may have sideeffects: https://dba.stackexchange.com/a/46199
su postgres -c "psql -d ${POSTGRESQL_DATABASE} -c \"UPDATE pg_cast SET castcontext='a' WHERE casttarget = 'boolean'::regtype;\""
