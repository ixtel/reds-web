#!/bin/sh

PREFIX=${PREFIX-"/usr/local"}
BRANCH=${BRANCH-"master"}
NAME=${NAME-"reds_web"}
NAMESPACE=${NAMESPACE-"dev.reds-web"}

BINPATH=${BINPATH-"${PREFIX}/bin"}
LIBPATH=${LIBPATH-"${PREFIX}/lib"}
ETCPATH=${ETCPATH-"${PREFIX}/etc"}
LOGPATH=${LOGPATH-"/var/log"}
TMPPATH=${TMPPATH-"/tmp"}

BINFILE_NODE=${BINFILE_NODE-"${BINPATH}/${NAME}_node"}
BINFILE_POD=${BINFILE_POD-"${BINPATH}/${NAME}_pod"}
ETCFILE_NODE=${ETCFILE_NODE-"${ETCPATH}/reds/${NAME}_node.json"}
ETCFILE_POD=${ETCFILE_POD-"${ETCPATH}/reds/${NAME}_pod.json"}
LOGFILE_NODE=${LOGFILE_NODE-"${LOGPATH}/${NAME}_node.log"}
LOGFILE_POD=${LOGFILE_POD-"${LOGPATH}/${NAME}_pod.log"}

PGROLE=${PGROLE-"${NAME}"}
PGDATABASE_NODE=${PGDATABASE_NODE-"${NAME}_node"}
PGDATABASE_POD=${PGDATABASE_POD-"${NAME}_pod"}

NODEJS=${NODEJS-`which node`}
PODSALT=${PODSALT-`cat /dev/urandom | head -c 32 | base64`}
PGPASSWORD=${PGPASSWORD-`cat /dev/urandom | tr -dc "A-Za-z0-9-_" | head -c 32`}

# INFO Read the pod password

stty -echo
read -p "Pod password: " PODPASSWORD
echo
read -p "Confirmation: " CONFIRMATION
echo
stty echo
if [ "${PODPASSWORD}" != "${CONFIRMATION}" ]; then
    echo "Password and confirmation mismatch!"
    exit 1
fi

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

if [ ! -e "${ETCFILE_NODE}" ]; then
    echo "{
        \"host\": null,
        \"port\": 8080,
        \"user\": \"nobody\",
        \"group\": \"nogroup\",
        \"workers\": 1,
        \"log\": null,
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
        \"crypto\": [\"256_AES128-CTR_SHA256_PBKDF2-HMAC-SHA256_SECP256K1-1\"],
        \"storage\": {
            \"name\": \"nodepg-1\",
            \"options\": {
                \"connect\": \"postgres://${PGROLE}:${PGPASSWORD}@localhost/${PGDATABASE_NODE}\"
            }
        },
        \"cors\": {
            \"origin\": \"*\",
            \"methods\": \"GET, POST, PUT, DELETE\",
            \"headers\": \"Content-Type, Authorization, X-REDS-Test\"
        }
    }" > "${ETCFILE_NODE}"
fi

if [ ! -e "${ETCFILE_POD}" ]; then
    echo "{
        \"host\": null,
        \"port\": 8181,
        \"user\": \"nobody\",
        \"group\": \"nogroup\",
        \"workers\": 1,
        \"log\": null,
        \"password\": \"${PODPASSWORD}\",
        \"salt\": \"${PODSALT}\",
        \"crypto\": [\"256_AES128-CTR_SHA256_PBKDF2-HMAC-SHA256_SECP256K1-1\"],
        \"storage\": {
            \"name\": \"nodepg-1\",
            \"options\": {
                \"connect\": \"postgres://${PGROLE}:${PGPASSWORD}@localhost/${PGDATABASE_POD}\"
            }
        }
    }" > "${ETCFILE_POD}"
fi

# INFO Create start scripts

if [ ! -e "${BINFILE_NODE}" ]; then
    echo "#!${NODEJS}
    var NodeServer = require(\"${LIBPATH}/reds/node/Server\");
    var config = require(\"${ETCFILE_NODE}\");
    var server = new NodeServer(config);
    server.run();" > "${BINFILE_NODE}"
    chmod a+x "${BINFILE_NODE}"
fi

if [ ! -e "${BINFILE_POD}" ]; then
    echo "#!${NODEJS}
    var PodServer = require(\"${LIBPATH}/reds/pod/Server\");
    var config = require(\"${ETCFILE_POD}\");
    var server = new PodServer(config);
    server.run();" > "${BINFILE_POD}"
    chmod a+x "${BINFILE_POD}"
fi

# INFO Create generic PostgreSQL user

sudo -u postgres psql -c "CREATE USER \"${PGROLE}\" WITH PASSWORD '${PGPASSWORD}';"

# INFO Setup PostgreSQL node database

sudo -u postgres psql -c "CREATE DATABASE \"${PGDATABASE_NODE}\" WITH TEMPLATE = template0 OWNER = \"${PGROLE}\";"
sudo -u postgres psql -d ${PGDATABASE_NODE} -f ${LIBPATH}/reds/shared/storage/NodePg/node.sql
sudo -u postgres psql -d ${PGDATABASE_NODE} -c "ALTER TABLE public.accounts OWNER TO \"${PGROLE}\";"
sudo -u postgres psql -d ${PGDATABASE_NODE} -c "ALTER TABLE public.domains OWNER TO \"${PGROLE}\";"
sudo -u postgres psql -d ${PGDATABASE_NODE} -c "ALTER TABLE public.entities OWNER TO \"${PGROLE}\";"
sudo -u postgres psql -d ${PGDATABASE_NODE} -c "ALTER TABLE public.invitations OWNER TO \"${PGROLE}\";"
sudo -u postgres psql -d ${PGDATABASE_NODE} -c "ALTER TABLE public.pods OWNER TO \"${PGROLE}\";"
sudo -u postgres psql -d ${PGDATABASE_NODE} -c "ALTER TABLE public.relations OWNER TO \"${PGROLE}\";"
sudo -u postgres psql -d ${PGDATABASE_NODE} -c "ALTER TABLE public.types OWNER TO \"${PGROLE}\";"

# INFO Setup PostgreSQL pod database

sudo -u postgres psql -c "CREATE DATABASE \"${PGDATABASE_POD}\" WITH TEMPLATE = template0 OWNER = \"${PGROLE}\";"
sudo -u postgres psql -d ${PGDATABASE_POD} -f ${LIBPATH}/reds/shared/storage/NodePg/pod.sql
sudo -u postgres psql -d ${PGDATABASE_POD} -c "ALTER TABLE public.nodes OWNER TO \"${PGROLE}\";"
