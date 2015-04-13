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
    echo "Git binary not executable - trying to find fallback."
    [ -z "$WGETBIN" ] && WGETBIN=`which wget`
    if [ ! -x "${WGETBIN}" ]; then
        echo "Wget binary not executable!"
        exit 3
    fi
    [ -z "$TARBIN" ] && TARBIN=`which tar`
    if [ ! -x "${TARBIN}" ]; then
        echo "Tar binary not executable!"
        exit 3
    fi
fi

# INFO Read the node namespace

if [ -z "${NAMESPACE}" ]; then
    echo "Application namespace"
    echo
    echo "The namespace is a globally unique name that identifies your app on the pod."
    echo "To ensure that the namespace is really unique it is strongly recommended to"
    echo "derive the namespace from a domain you own:"
    echo
    echo "domain-toplevel.domain-name.application-name (e.g. com.flowyapps.flowynotes)"
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
[ -z "$BRANCH" ] && BRANCH="master"
[ -z "$SALT" ] && SALT=`cat /dev/urandom | head -c 32 | base64`

[ -z "$BINPATH" ] && BINPATH="${PREFIX}/bin"
[ -z "$LIBPATH" ] && LIBPATH="${PREFIX}/lib"
[ -z "$ETCPATH" ] && ETCPATH="${PREFIX}/etc"
[ -z "$LOGPATH" ] && LOGPATH="/var/log"
[ -z "$TMPPATH" ] && TMPPATH="/tmp"

[ -z "$BINFILE" ] && BINFILE="${BINPATH}/${NAME}_node"
[ -z "$ETCFILE" ] && ETCFILE="${ETCPATH}/reds/${NAME}_node.json"
[ -z "$LOGFILE" ] && LOGFILE="${LOGPATH}/${NAME}_node.log"

[ -z "$POSTGRESQL_ROLE" ] && POSTGRESQL_ROLE="${NAME}_node"
[ -z "$POSTGRESQL_PASSWORD" ] && POSTGRESQL_PASSWORD=`cat /dev/urandom | LC_CTYPE=C tr -dc "A-Za-z0-9-_" | head -c 22`
[ -z "$POSTGRESQL_DATABASE" ] && POSTGRESQL_DATABASE="${NAME}_node"

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
        git clone -b ${BRANCH} https://github.com/flowyapps/reds-web "${LIBPATH}/reds"
    else 
        wget https://github.com/flowyapps/reds-web/archive/${BRANCH}.tar.gz -O "${TMPPATH}/reds-web-${BRANCH}.tar.gz"
        tar xfz "${TMPPATH}/reds-web-${BRANCH}.tar.gz" -C "${TMPPATH}"
        mv "${TMPPATH}/reds-web-${BRANCH}" "${LIBPATH}/reds"
        rm "${TMPPATH}/reds-web-${BRANCH}.tar.gz"
    fi
fi

# INFO Create config file

if [ ! -e "${ETCFILE}" ]; then
    echo "{
    \"host\": null,
    \"port\": 5514,
    \"user\": \"nobody\",
    \"group\": \"nogroup\",
    \"workers\": 1,
    \"log\": \"info\",
    \"salt\": \"${SALT}\",
    \"namespace\": \"${NAMESPACE}\",
    \"types\": \"${ETCPATH}/reds/${NAME}_types.json\",
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

# INFO Create start script

if [ ! -e "${BINFILE}" ]; then
    echo "#!${NODEBIN}
var NodeServer = require(\"${LIBPATH}/reds/node/Server\");
var server = new NodeServer(\"${ETCFILE}\");
server.run();" > "${BINFILE}"
    chmod a+x "${BINFILE}"
fi

# INFO Setup PostgreSQL database

sudo -u postgres psql -c "CREATE USER \"${POSTGRESQL_ROLE}\" WITH PASSWORD '${POSTGRESQL_PASSWORD}';"
sudo -u postgres psql -c "CREATE DATABASE \"${POSTGRESQL_DATABASE}\" WITH TEMPLATE = template0 OWNER = \"${POSTGRESQL_ROLE}\";"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -f "${LIBPATH}/reds/shared/storage/postgresql/node.sql"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -c "ALTER TABLE public.accounts OWNER TO \"${POSTGRESQL_ROLE}\";"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -c "ALTER TABLE public.domains OWNER TO \"${POSTGRESQL_ROLE}\";"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -c "ALTER TABLE public.entities OWNER TO \"${POSTGRESQL_ROLE}\";"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -c "ALTER TABLE public.invitations OWNER TO \"${POSTGRESQL_ROLE}\";"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -c "ALTER TABLE public.pods OWNER TO \"${POSTGRESQL_ROLE}\";"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -c "ALTER TABLE public.relations OWNER TO \"${POSTGRESQL_ROLE}\";"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -c "ALTER TABLE public.types OWNER TO \"${POSTGRESQL_ROLE}\";"
