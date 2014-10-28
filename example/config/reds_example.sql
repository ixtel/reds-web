--
-- User creation
--

CREATE USER reds_example WITH PASSWORD 'foobar';

--
-- Database creation
--

CREATE DATABASE reds_example_node WITH TEMPLATE = template0 OWNER = reds_example;
CREATE DATABASE reds_example_pod WITH TEMPLATE = template0 OWNER = reds_example;

\connect reds_example_node

--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plperl; Type: PROCEDURAL LANGUAGE; Schema: -; Owner: reds_example
--

CREATE OR REPLACE PROCEDURAL LANGUAGE plperl;


ALTER PROCEDURAL LANGUAGE plperl OWNER TO reds_example;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET search_path = public, pg_catalog;

--
-- Name: after_delete_entity(); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION after_delete_entity() RETURNS trigger
    LANGUAGE plperl
    AS $_X$
	spi_exec_query("UPDATE domains SET ecount = ecount-1 WHERE did = $_TD->{old}{did};", 1);
	spi_exec_query("DELETE FROM relations WHERE parent = $_TD->{old}{eid}", 1);
	return;
$_X$;


ALTER FUNCTION public.after_delete_entity() OWNER TO reds_example;

--
-- Name: after_delete_relation(); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION after_delete_relation() RETURNS trigger
    LANGUAGE plperl
    AS $_X$
	spi_exec_query("DELETE FROM entities WHERE eid = $_TD->{old}{child}", 1);
	return;
$_X$;


ALTER FUNCTION public.after_delete_relation() OWNER TO reds_example;

--
-- Name: after_insert_entity(); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION after_insert_entity() RETURNS trigger
    LANGUAGE plperl
    AS $_X$
	spi_exec_query("UPDATE domains SET ecount = ecount+1 WHERE did = $_TD->{new}{did};", 1);
	return;
$_X$;


ALTER FUNCTION public.after_insert_entity() OWNER TO reds_example;

--
-- Name: before_delete_entity(); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION before_delete_entity() RETURNS trigger
    LANGUAGE plperl
    AS $_X$
	if ($_SHARED{cascade_domain} && ($_SHARED{cascade_domain} != $_TD->{old}{did})) {
		return "SKIP";
	}
	if ($_SHARED{simulation_active}) {
		$_SHARED{simulation_result} = $_SHARED{simulation_result}.$_TD->{old}{eid}.",";
		spi_exec_query("DELETE FROM relations WHERE parent = $_TD->{old}{eid}", 1);
		return "SKIP";
	}
	return;
$_X$;


ALTER FUNCTION public.before_delete_entity() OWNER TO reds_example;

--
-- Name: before_delete_relation(); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION before_delete_relation() RETURNS trigger
    LANGUAGE plperl
    AS $_X$
	if ($_SHARED{simulation_active}) {
		spi_exec_query("DELETE FROM entities WHERE eid = $_TD->{old}{child}", 1);
		return "SKIP";
	}
	return;
$_X$;


ALTER FUNCTION public.before_delete_relation() OWNER TO reds_example;

--
-- Name: plperl_call_handler(); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION plperl_call_handler() RETURNS language_handler
    LANGUAGE c
    AS '$libdir/plperl', 'plperl_call_handler';


ALTER FUNCTION public.plperl_call_handler() OWNER TO reds_example;

--
-- Name: plperl_inline_handler(internal); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION plperl_inline_handler(internal) RETURNS void
    LANGUAGE c
    AS '$libdir/plperl', 'plperl_inline_handler';


ALTER FUNCTION public.plperl_inline_handler(internal) OWNER TO reds_example;

--
-- Name: plperl_validator(oid); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION plperl_validator(oid) RETURNS void
    LANGUAGE c STRICT
    AS '$libdir/plperl', 'plperl_validator';


ALTER FUNCTION public.plperl_validator(oid) OWNER TO reds_example;

--
-- Name: set_cascade_domain(integer); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION set_cascade_domain(integer) RETURNS text
    LANGUAGE plperl
    AS $_X$
	$_SHARED{cascade_domain} = $_[0];
	return $_SHARED{cascade_domain};
$_X$;


ALTER FUNCTION public.set_cascade_domain(integer) OWNER TO reds_example;

--
-- Name: simulate(text); Type: FUNCTION; Schema: public; Owner: reds_example
--

CREATE FUNCTION simulate(text) RETURNS text
    LANGUAGE plperl
    AS $_X$
	$_SHARED{simulation_active} = 1;
	spi_exec_query($_[0], 0);
	$_SHARED{simulation_active} = 0;
	chop($_SHARED{simulation_result});
	return $_SHARED{simulation_result};
$_X$;


ALTER FUNCTION public.simulate(text) OWNER TO reds_example;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE accounts (
    aid integer NOT NULL,
    alias bytea NOT NULL,
    auth bytea NOT NULL,
    asalt bytea NOT NULL,
    vault bytea,
    vec bytea
);


ALTER TABLE public.accounts OWNER TO reds_example;

--
-- Name: domains; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE domains (
    did integer NOT NULL,
    pid integer NOT NULL,
    ecount integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.domains OWNER TO reds_example;

--
-- Name: domains_did_seq; Type: SEQUENCE; Schema: public; Owner: reds_example
--

CREATE SEQUENCE domains_did_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.domains_did_seq OWNER TO reds_example;

--
-- Name: domains_did_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_example
--

ALTER SEQUENCE domains_did_seq OWNED BY domains.did;


--
-- Name: entities; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE entities (
    eid integer NOT NULL,
    tid integer,
    did integer NOT NULL
);


ALTER TABLE public.entities OWNER TO reds_example;

--
-- Name: entities_eid_seq; Type: SEQUENCE; Schema: public; Owner: reds_example
--

CREATE SEQUENCE entities_eid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.entities_eid_seq OWNER TO reds_example;

--
-- Name: entities_eid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_example
--

ALTER SEQUENCE entities_eid_seq OWNED BY entities.eid;


--
-- Name: pods; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE pods (
    pid integer NOT NULL,
    url text NOT NULL,
    auth bytea
);


ALTER TABLE public.pods OWNER TO reds_example;

--
-- Name: pods_id_seq; Type: SEQUENCE; Schema: public; Owner: reds_example
--

CREATE SEQUENCE pods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pods_id_seq OWNER TO reds_example;

--
-- Name: pods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_example
--

ALTER SEQUENCE pods_id_seq OWNED BY pods.pid;


--
-- Name: relations; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE relations (
    parent integer NOT NULL,
    child integer NOT NULL
);


ALTER TABLE public.relations OWNER TO reds_example;

--
-- Name: types; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE types (
    tid integer NOT NULL,
    name character varying(256) NOT NULL
);


ALTER TABLE public.types OWNER TO reds_example;

--
-- Name: types_tid_seq; Type: SEQUENCE; Schema: public; Owner: reds_example
--

CREATE SEQUENCE types_tid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.types_tid_seq OWNER TO reds_example;

--
-- Name: types_tid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_example
--

ALTER SEQUENCE types_tid_seq OWNED BY types.tid;


--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: reds_example
--

CREATE SEQUENCE user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_id_seq OWNER TO reds_example;

--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_example
--

ALTER SEQUENCE user_id_seq OWNED BY accounts.aid;


--
-- Name: aid; Type: DEFAULT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY accounts ALTER COLUMN aid SET DEFAULT nextval('user_id_seq'::regclass);


--
-- Name: did; Type: DEFAULT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY domains ALTER COLUMN did SET DEFAULT nextval('domains_did_seq'::regclass);


--
-- Name: eid; Type: DEFAULT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY entities ALTER COLUMN eid SET DEFAULT nextval('entities_eid_seq'::regclass);


--
-- Name: pid; Type: DEFAULT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY pods ALTER COLUMN pid SET DEFAULT nextval('pods_id_seq'::regclass);


--
-- Name: tid; Type: DEFAULT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY types ALTER COLUMN tid SET DEFAULT nextval('types_tid_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY accounts (aid, alias, auth, asalt, vault, vec) FROM stdin;
\.


--
-- Data for Name: domains; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY domains (did, pid, ecount) FROM stdin;
\.


--
-- Name: domains_did_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_example
--

SELECT pg_catalog.setval('domains_did_seq', 1, false);


--
-- Data for Name: entities; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY entities (eid, tid, did) FROM stdin;
\.


--
-- Name: entities_eid_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_example
--

SELECT pg_catalog.setval('entities_eid_seq', 1, false);


--
-- Data for Name: pods; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY pods (pid, url, auth) FROM stdin;
1	localhost:8181	\N
\.


--
-- Name: pods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_example
--

SELECT pg_catalog.setval('pods_id_seq', 1, false);


--
-- Data for Name: relations; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY relations (parent, child) FROM stdin;
\.


--
-- Data for Name: types; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY types (tid, name) FROM stdin;
1	contact
2	address
\.


--
-- Name: types_tid_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_example
--

SELECT pg_catalog.setval('types_tid_seq', 2, true);


--
-- Name: user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_example
--

SELECT pg_catalog.setval('user_id_seq', 1, false);


--
-- Name: accounts_alias; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY accounts
    ADD CONSTRAINT accounts_alias UNIQUE (alias);


--
-- Name: accounts_id; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY accounts
    ADD CONSTRAINT accounts_id PRIMARY KEY (aid);


--
-- Name: domains_did; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY domains
    ADD CONSTRAINT domains_did PRIMARY KEY (did);


--
-- Name: entities_eid; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY entities
    ADD CONSTRAINT entities_eid PRIMARY KEY (eid);


--
-- Name: pods_id; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY pods
    ADD CONSTRAINT pods_id PRIMARY KEY (pid);


--
-- Name: relations_parent_child; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY relations
    ADD CONSTRAINT relations_parent_child PRIMARY KEY (parent, child);


--
-- Name: types_tid; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY types
    ADD CONSTRAINT types_tid PRIMARY KEY (tid);


--
-- Name: after_delete_entity_trigger; Type: TRIGGER; Schema: public; Owner: reds_example
--

CREATE TRIGGER after_delete_entity_trigger AFTER DELETE ON entities FOR EACH ROW EXECUTE PROCEDURE after_delete_entity();


--
-- Name: after_delete_relation_trigger; Type: TRIGGER; Schema: public; Owner: reds_example
--

CREATE TRIGGER after_delete_relation_trigger AFTER DELETE ON relations FOR EACH ROW EXECUTE PROCEDURE after_delete_relation();


--
-- Name: after_insert_entity_trigger; Type: TRIGGER; Schema: public; Owner: reds_example
--

CREATE TRIGGER after_insert_entity_trigger AFTER INSERT ON entities FOR EACH ROW EXECUTE PROCEDURE after_insert_entity();


--
-- Name: before_delete_entity_trigger; Type: TRIGGER; Schema: public; Owner: reds_example
--

CREATE TRIGGER before_delete_entity_trigger BEFORE DELETE ON entities FOR EACH ROW EXECUTE PROCEDURE before_delete_entity();


--
-- Name: before_delete_relation_trigger; Type: TRIGGER; Schema: public; Owner: reds_example
--

CREATE TRIGGER before_delete_relation_trigger BEFORE DELETE ON relations FOR EACH ROW EXECUTE PROCEDURE before_delete_relation();


--
-- Name: domains_pid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY domains
    ADD CONSTRAINT domains_pid_fkey FOREIGN KEY (pid) REFERENCES pods(pid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: entities_did_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY entities
    ADD CONSTRAINT entities_did_fkey FOREIGN KEY (did) REFERENCES domains(did) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: entities_tid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY entities
    ADD CONSTRAINT entities_tid_fkey FOREIGN KEY (tid) REFERENCES types(tid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: relations_child_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY relations
    ADD CONSTRAINT relations_child_fkey FOREIGN KEY (child) REFERENCES entities(eid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: relations_parent_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY relations
    ADD CONSTRAINT relations_parent_fkey FOREIGN KEY (parent) REFERENCES entities(eid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\connect reds_example_pod

--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: address; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE address (
    eid integer NOT NULL,
    did integer NOT NULL,
    street text,
    city text
);


ALTER TABLE public.address OWNER TO reds_example;

--
-- Name: contact; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE contact (
    eid integer NOT NULL,
    did integer NOT NULL,
    name text
);


ALTER TABLE public.contact OWNER TO reds_example;

--
-- Name: contact_eid_seq; Type: SEQUENCE; Schema: public; Owner: reds_example
--

CREATE SEQUENCE contact_eid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.contact_eid_seq OWNER TO reds_example;

--
-- Name: contact_eid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_example
--

ALTER SEQUENCE contact_eid_seq OWNED BY contact.eid;


--
-- Name: domains; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE domains (
    did integer NOT NULL,
    dkey bytea NOT NULL
);


ALTER TABLE public.domains OWNER TO reds_example;

--
-- Name: domains_did_seq; Type: SEQUENCE; Schema: public; Owner: reds_example
--

CREATE SEQUENCE domains_did_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.domains_did_seq OWNER TO reds_example;

--
-- Name: domains_did_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_example
--

ALTER SEQUENCE domains_did_seq OWNED BY domains.did;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: reds_example; Tablespace: 
--

CREATE TABLE tickets (
    tid integer NOT NULL,
    did integer NOT NULL,
    tkey bytea NOT NULL,
    tflags integer NOT NULL
);


ALTER TABLE public.tickets OWNER TO reds_example;

--
-- Name: tickets_tid_seq; Type: SEQUENCE; Schema: public; Owner: reds_example
--

CREATE SEQUENCE tickets_tid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tickets_tid_seq OWNER TO reds_example;

--
-- Name: tickets_tid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_example
--

ALTER SEQUENCE tickets_tid_seq OWNED BY tickets.tid;


--
-- Name: tid; Type: DEFAULT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY tickets ALTER COLUMN tid SET DEFAULT nextval('tickets_tid_seq'::regclass);


--
-- Data for Name: address; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY address (eid, did, street, city) FROM stdin;
\.


--
-- Data for Name: contact; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY contact (eid, did, name) FROM stdin;
\.


--
-- Name: contact_eid_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_example
--

SELECT pg_catalog.setval('contact_eid_seq', 1, false);


--
-- Data for Name: domains; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY domains (did, dkey) FROM stdin;
\.


--
-- Name: domains_did_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_example
--

SELECT pg_catalog.setval('domains_did_seq', 1, false);


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: reds_example
--

COPY tickets (tid, did, tkey, tflags) FROM stdin;
\.


--
-- Name: tickets_tid_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_example
--

SELECT pg_catalog.setval('tickets_tid_seq', 1, false);


--
-- Name: address_eid; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY address
    ADD CONSTRAINT address_eid PRIMARY KEY (eid);


--
-- Name: contact_eid; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY contact
    ADD CONSTRAINT contact_eid PRIMARY KEY (eid);


--
-- Name: domains_did; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY domains
    ADD CONSTRAINT domains_did PRIMARY KEY (did);


--
-- Name: tickets_tid; Type: CONSTRAINT; Schema: public; Owner: reds_example; Tablespace: 
--

ALTER TABLE ONLY tickets
    ADD CONSTRAINT tickets_tid PRIMARY KEY (tid);


--
-- Name: address_did_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY address
    ADD CONSTRAINT address_did_fkey FOREIGN KEY (did) REFERENCES domains(did) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: contact_did_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY contact
    ADD CONSTRAINT contact_did_fkey FOREIGN KEY (did) REFERENCES domains(did) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tickets_did_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_example
--

ALTER TABLE ONLY tickets
    ADD CONSTRAINT tickets_did_fkey FOREIGN KEY (did) REFERENCES domains(did) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--
