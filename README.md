#REDS.web

REDS.web is an open-source web application framework based on the REDS data storage. The framework is mainly written in JavaScript and contains the code for all client- and server-side components required to run a webapp with REDS. It is still under development so take care if you to use REDS.web on production systems right now. 

The REDS concept allows users to decide freely where they want to store their data. All data transfers and account information are encrypted, so the webapp can be used privately and anonymously. However, the provider can still control the access to the webapp and its data, so it is still possible to run a service based on subscriptions or a freemium model.

## Installation

If you want to **set up you own REDS.web pod** just install the latest stable versions of *curl*, *git*, [*PostgreSQL*](http://www.postgresql.org/), [*Node.js*](https://nodejs.org/) and [*node-postgres*](https://github.com/brianc/node-postgres). Then run:

    sudo sh <(curl https://raw.githubusercontent.com/flowyapps/reds-web/master/tools/install_pod.sh)

You can start the pod with `/usr/local/bin/reds_pod`. It listens on port 8515.

## Documentation

The [REDS.web Wiki](https://github.com/flowyapps/reds-web/wiki) contains details about the [node-setup](https://github.com/flowyapps/reds-web/wiki/REDS-node-setup) and [pod-setup](https://github.com/flowyapps/reds-web/wiki/REDS-pod-setup), the [client API](https://github.com/flowyapps/reds-web/wiki/Client-module-API) as well as other texts that help you to get started.

## Contact

REDS.web is maintained by Flowy Apps. More information about REDS and Flowy Apps can be found on the following websites:

  * The official REDS website: http://reds.io
  * The website of Flowy Apps: http://flowyapps.com

## License

REDS.web is published as open-source under the [Affero General Public License 3.0](http://www.gnu.org/licenses/agpl-3.0.html). For closed source applications an alternative commercial license will be offered. Please [contact Flowy Apps](http://flowyapps.com/home#contact), if you have questions concerning the commercial licence.
