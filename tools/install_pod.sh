#!/bin/sh

# INFO Detect Node.js binary

NODEJS=${NODEJS-`which nodejs`}
if [ -z "${NAME}" ]
    NODEJS=${NODEJS-`which node`}
    if [ -z "${NAME}" ]
        echo "Node.js binary not found in path!"
        exit 1
    fi
fi
if [ ! -x "${NAME}" ]
    echo "Node.js binary is not executable!"
    exit 2
fi

# INFO Read the node namespace

echo "Pod password"
echo
echo "The pod password prevents others from using your pod to store their data on it."
echo "Apart from that it also ensures thay you're really using your pod to store your data."
echo "The pod password is not required to share data on your pod with others."
echo
stty -echo
read -p "Password: " PODPASSWORD
echo
read -p "Confirmation: " CONFIRMATION
echo
echo
stty echo
if [ "${PODPASSWORD}" != "${CONFIRMATION}" ]; then
    echo "The password and confirmation mismatch!"
    exit 1
fi

# INFO Define variables

NAME=${NAME-"reds"}
PREFIX=${PREFIX-"/usr/local"}
BRANCH=${BRANCH-"master"}
SALT=${SALT-`cat /dev/urandom | head -c 32 | base64`}

BINPATH=${BINPATH-"${PREFIX}/bin"}
LIBPATH=${LIBPATH-"${PREFIX}/lib"}
ETCPATH=${ETCPATH-"${PREFIX}/etc"}
LOGPATH=${LOGPATH-"/var/log"}
TMPPATH=${TMPPATH-"/tmp"}

BINFILE=${BINFILE-"${BINPATH}/${NAME}_pod"}
ETCFILE=${ETCFILE-"${ETCPATH}/reds/${NAME}_pod.json"}
LOGFILE=${LOGFILE-"${LOGPATH}/${NAME}_pod.log"}

POSTGRESQL_ROLE=${POSTGRESQL_ROLE-"${NAME}_pod"}
POSTGRESQL_PASSWORD=${POSTGRESQL_PASSWORD-`cat /dev/urandom | tr -dc "A-Za-z0-9-_" | head -c 32`}
POSTGRESQL_DATABASE=${POSTGRESQL_DATABASE-"${NAME}_pod"}

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

# INFO Create config files

if [ ! -e "${ETCFILE}" ]; then
    echo "{
        \"host\": null,
        \"port\": 5614,
        \"user\": \"nobody\",
        \"group\": \"nogroup\",
        \"workers\": 1,
        \"log\": "info",
        \"salt\": \"${SALT}\",
        \"password\": \"${PODPASSWORD}\",
        \"crypto\": [
            \"256_AES128-CTR_SHA256_PBKDF2-HMAC-SHA256_SECP256K1-1\"
        ],
        \"storage\": {
            \"name\": \"POSTGRESQL-1\",
            \"options\": {
                \"connect\": \"postgres://${NODEPG_ROLE}:${NODEPG_PASSWORD}@localhost/${NODEPG_DATABASE}\"
            }
        }
    }" > "${ETCFILE}"
fi

# INFO Create start scripts

if [ ! -e "${BINFILE}" ]; then
    echo "#!${NODEJS}
    var PodServer = require(\"${LIBPATH}/reds/pod/Server\");
    var config = require(\"${ETCFILE}\");
    var server = new PodServer(config);
    server.run();" > "${BINFILE}"
    chmod a+x "${BINFILE}"
fi

# INFO Setup PostgreSQL database

sudo -u postgres psql -c "CREATE USER \"${POSTGRESQL_ROLE}\" WITH PASSWORD '${POSTGRESQL_PASSWORD}';"
sudo -u postgres psql -c "CREATE DATABASE \"${POSTGRESQL_DATABASE}\" WITH TEMPLATE = template0 OWNER = \"${POSTGRESQL_ROLE}\";"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -f "${LIBPATH}/reds/shared/storage/postgresql/pod.sql"
sudo -u postgres psql -d ${POSTGRESQL_DATABASE} -c "ALTER TABLE public.nodes OWNER TO \"${POSTGRESQL_ROLE}\";"
