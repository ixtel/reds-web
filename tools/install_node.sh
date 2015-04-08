#!/bin/sh

# INFO Detect Node.js binary

NODEJS=${NODEJS-`which nodejs`}
if [ -z "${NODEJS}" ]; then
    NODEJS=${NODEJS-`which nodejs`}
    if [ -z "${NODEJS}" ]; then
        echo "Node.js binary not found in path!"
        exit 1
    fi
fi
if [ ! -x "${NODEJS}" ]; then
    echo "Node.js binary is not executable!"
    exit 2
fi

# INFO Read the node namespace

echo "Node namespace"
echo
echo "The node namespace is a globally unique name that identifies your app on the pod."
echo "To ensure that the namespace is really unique it is strongly recommended to derive"
echo "the namespace from a domain you own:"
echo
echo "domain-toplevel.domain-name.application-name (e.g. com.flowyapps.flowynotes)"
echo
read -p "Namespace: " NAMESPACE
echo
NAME=`expr "${NAMESPACE}" : '[A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9-]*\.\([A-Za-z0-9][A-Za-z0-9-]*\)'`
if [ -z "${NAME}" ]; then
    echo "Invalid namespace format!"
    exit 3
fi

# INFO Define variables

PREFIX=${PREFIX-"/usr/local"}
BRANCH=${BRANCH-"master"}
SALT=${SALT-`cat /dev/urandom | head -c 32 | base64`}

BINPATH=${BINPATH-"${PREFIX}/bin"}
LIBPATH=${LIBPATH-"${PREFIX}/lib"}
ETCPATH=${ETCPATH-"${PREFIX}/etc"}
LOGPATH=${LOGPATH-"/var/log"}
TMPPATH=${TMPPATH-"/tmp"}

BINFILE=${BINFILE-"${BINPATH}/${NAME}_node"}
ETCFILE=${ETCFILE-"${ETCPATH}/reds/${NAME}_node.json"}
LOGFILE=${LOGFILE-"${LOGPATH}/${NAME}_node.log"}

POSTGRESQL_ROLE=${POSTGRESQL_ROLE-"${NAME}_node"}
POSTGRESQL_PASSWORD=${POSTGRESQL_PASSWORD-`cat /dev/urandom | tr -dc "A-Za-z0-9-_" | head -c 32`}
POSTGRESQL_DATABASE=${POSTGRESQL_DATABASE-"${NAME}_node"}


# INFO Create required paths

mkdir -p "${BINPATH}"
mkdir -p "${LIBPATH}"
mkdir -p "${ETCPATH}/reds"
mkdir -p "${LOGPATH}"
mkdir -p "${TMPPATH}"

# INFO Download and install REDS library

if [ ! -e "${LIBPATH}/reds" ]; then
    wget https://github.com/flowyapps/reds-web/archive/${BRANCH}.tar.gz -O "${TMPPATH}/reds-web-${BRANCH}.tar.gz"
    tar xfz "${TMPPATH}/reds-web-${BRANCH}.tar.gz" -C "${TMPPATH}"
    mv "${TMPPATH}/reds-web-${BRANCH}" "${LIBPATH}/reds"
    rm "${TMPPATH}/reds-web-${BRANCH}.tar.gz"
fi

# INFO Create config file

if [ ! -e "${ETCFILE}.sample" ]; then
    echo "{
        \"host\": null,
        \"port\": 5514,
        \"user\": \"nobody\",
        \"group\": \"nogroup\",
        \"workers\": 1,
        \"log\": \"debug\",
        \"salt\": \"${SALT}\",
        \"namespace\": \"${NAMESPACE}\",
        \"types\": {
            \"contact\": {
                \"name\": \"text\"
            },
            \"address\": {
                \"street\": \"text\",
                \"city\": \"text\"
            }
        },
        \"crypto\": [
            \"256_AES128-CTR_SHA256_PBKDF2-HMAC-SHA256_SECP256K1-1\"
        ],
        \"storage\": {
            \"name\": \"POSTGRESQL\",
            \"options\": {
                \"connect\": \"postgres://${POSTGRESQL_ROLE}:${POSTGRESQL_PASSWORD}@localhost/${POSTGRESQL_DATABASE}\"
            }
        }
    }" > "${ETCFILE}.sample"
fi

# INFO Create start script

if [ ! -e "${BINFILE}" ]; then
    echo "#!${NODEJS}
    var NodeServer = require(\"${LIBPATH}/reds/node/Server\");
    var config = require(\"${ETCFILE}\");
    var server = new NodeServer(config);
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
