--
-- PostgreSQL database dump
--

SET default_transaction_read_only = off;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plperl; Type: PROCEDURAL LANGUAGE; Schema: -; Owner: reds_web
--

CREATE OR REPLACE PROCEDURAL LANGUAGE plperl;


-- ALTER PROCEDURAL LANGUAGE plperl OWNER TO reds_web;

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
-- Name: after_delete_entity(); Type: FUNCTION; Schema: public; Owner: reds_web
--

CREATE FUNCTION after_delete_entity() RETURNS trigger
    LANGUAGE plperl
    AS $_X$
	spi_exec_query("DELETE FROM relations WHERE parent = $_TD->{old}{eid}", 1);
	return;
$_X$;


-- ALTER FUNCTION public.after_delete_entity() OWNER TO reds_web;

--
-- Name: after_delete_relation(); Type: FUNCTION; Schema: public; Owner: reds_web
--

CREATE FUNCTION after_delete_relation() RETURNS trigger
    LANGUAGE plperl
    AS $_X$
	if ($_TD->{old}{hard} eq "t") {
		spi_exec_query("DELETE FROM entities WHERE eid = $_TD->{old}{child}", 1);
	}
	return;
$_X$;


-- ALTER FUNCTION public.after_delete_relation() OWNER TO reds_web;

--
-- Name: before_delete_entity(); Type: FUNCTION; Schema: public; Owner: reds_web
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


-- ALTER FUNCTION public.before_delete_entity() OWNER TO reds_web;

--
-- Name: before_delete_relation(); Type: FUNCTION; Schema: public; Owner: reds_web
--

CREATE FUNCTION before_delete_relation() RETURNS trigger
    LANGUAGE plperl
    AS $_X$
	if ($_SHARED{simulation_active}) {
		if ($_TD->{old}{hard} eq "t") {
			spi_exec_query("DELETE FROM entities WHERE eid = $_TD->{old}{child}", 1);
		}
		return "SKIP";
	}
	return;
$_X$;


-- ALTER FUNCTION public.before_delete_relation() OWNER TO reds_web;

--
-- Name: before_insert_relation(); Type: FUNCTION; Schema: public; Owner: reds_web
--

CREATE FUNCTION before_insert_relation() RETURNS trigger
    LANGUAGE plperl
    AS $_X$
	if ($_TD->{new}{hard} eq "t") {
		spi_exec_query("UPDATE relations SET hard=false WHERE hard = true AND child = $_TD->{new}{child}", 1);
	}
	return;
$_X$;


-- ALTER FUNCTION public.before_insert_relation() OWNER TO reds_web;

--
-- Name: plperl_call_handler(); Type: FUNCTION; Schema: public; Owner: reds_web
--

CREATE FUNCTION plperl_call_handler() RETURNS language_handler
    LANGUAGE c
    AS '$libdir/plperl', 'plperl_call_handler';


-- ALTER FUNCTION public.plperl_call_handler() OWNER TO reds_web;

--
-- Name: plperl_inline_handler(internal); Type: FUNCTION; Schema: public; Owner: reds_web
--

CREATE FUNCTION plperl_inline_handler(internal) RETURNS void
    LANGUAGE c
    AS '$libdir/plperl', 'plperl_inline_handler';


-- ALTER FUNCTION public.plperl_inline_handler(internal) OWNER TO reds_web;

--
-- Name: plperl_validator(oid); Type: FUNCTION; Schema: public; Owner: reds_web
--

CREATE FUNCTION plperl_validator(oid) RETURNS void
    LANGUAGE c STRICT
    AS '$libdir/plperl', 'plperl_validator';


-- ALTER FUNCTION public.plperl_validator(oid) OWNER TO reds_web;

--
-- Name: set_cascade_domain(integer); Type: FUNCTION; Schema: public; Owner: reds_web
--

CREATE FUNCTION set_cascade_domain(integer) RETURNS text
    LANGUAGE plperl
    AS $_X$
	$_SHARED{cascade_domain} = $_[0];
	return $_SHARED{cascade_domain};
$_X$;


-- ALTER FUNCTION public.set_cascade_domain(integer) OWNER TO reds_web;

--
-- Name: simulate(text); Type: FUNCTION; Schema: public; Owner: reds_web
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


-- ALTER FUNCTION public.simulate(text) OWNER TO reds_web;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: reds_web; Tablespace: 
--

CREATE TABLE accounts (
    aid integer NOT NULL,
    alias bytea NOT NULL,
    auth bytea NOT NULL,
    asalt bytea NOT NULL,
    vault bytea,
    vec bytea,
    modified bigint NOT NULL
);


-- ALTER TABLE public.accounts OWNER TO reds_web;

--
-- Name: domains; Type: TABLE; Schema: public; Owner: reds_web; Tablespace: 
--

CREATE TABLE domains (
    did integer NOT NULL,
    pid integer NOT NULL
);


-- ALTER TABLE public.domains OWNER TO reds_web;

--
-- Name: domains_did_seq; Type: SEQUENCE; Schema: public; Owner: reds_web
--

CREATE SEQUENCE domains_did_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER TABLE public.domains_did_seq OWNER TO reds_web;

--
-- Name: domains_did_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_web
--

ALTER SEQUENCE domains_did_seq OWNED BY domains.did;


--
-- Name: entities; Type: TABLE; Schema: public; Owner: reds_web; Tablespace: 
--

CREATE TABLE entities (
    eid integer NOT NULL,
    tid integer,
    did integer NOT NULL
);


-- ALTER TABLE public.entities OWNER TO reds_web;

--
-- Name: entities_eid_seq; Type: SEQUENCE; Schema: public; Owner: reds_web
--

CREATE SEQUENCE entities_eid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER TABLE public.entities_eid_seq OWNER TO reds_web;

--
-- Name: entities_eid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_web
--

ALTER SEQUENCE entities_eid_seq OWNED BY entities.eid;


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: reds_web; Tablespace: 
--

CREATE TABLE invitations (
    iid bytea NOT NULL,
    did integer NOT NULL,
    "timestamp" timestamp without time zone NOT NULL
);


-- ALTER TABLE public.invitations OWNER TO reds_web;

--
-- Name: pods; Type: TABLE; Schema: public; Owner: reds_web; Tablespace: 
--

CREATE TABLE pods (
    pid integer NOT NULL,
    url text NOT NULL,
    nid integer,
    auth bytea
);


-- ALTER TABLE public.pods OWNER TO reds_web;

--
-- Name: pods_id_seq; Type: SEQUENCE; Schema: public; Owner: reds_web
--

CREATE SEQUENCE pods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER TABLE public.pods_id_seq OWNER TO reds_web;

--
-- Name: pods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_web
--

ALTER SEQUENCE pods_id_seq OWNED BY pods.pid;


--
-- Name: relations; Type: TABLE; Schema: public; Owner: reds_web; Tablespace: 
--

CREATE TABLE relations (
    parent integer NOT NULL,
    child integer NOT NULL,
    hard boolean NOT NULL
);


-- ALTER TABLE public.relations OWNER TO reds_web;

--
-- Name: types; Type: TABLE; Schema: public; Owner: reds_web; Tablespace: 
--

CREATE TABLE types (
    tid integer NOT NULL,
    name character varying(256) NOT NULL
);


-- ALTER TABLE public.types OWNER TO reds_web;

--
-- Name: types_tid_seq; Type: SEQUENCE; Schema: public; Owner: reds_web
--

CREATE SEQUENCE types_tid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER TABLE public.types_tid_seq OWNER TO reds_web;

--
-- Name: types_tid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_web
--

ALTER SEQUENCE types_tid_seq OWNED BY types.tid;


--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: reds_web
--

CREATE SEQUENCE user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER TABLE public.user_id_seq OWNER TO reds_web;

--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_web
--

ALTER SEQUENCE user_id_seq OWNED BY accounts.aid;


--
-- Name: aid; Type: DEFAULT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY accounts ALTER COLUMN aid SET DEFAULT nextval('user_id_seq'::regclass);


--
-- Name: did; Type: DEFAULT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY domains ALTER COLUMN did SET DEFAULT nextval('domains_did_seq'::regclass);


--
-- Name: eid; Type: DEFAULT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY entities ALTER COLUMN eid SET DEFAULT nextval('entities_eid_seq'::regclass);


--
-- Name: pid; Type: DEFAULT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY pods ALTER COLUMN pid SET DEFAULT nextval('pods_id_seq'::regclass);


--
-- Name: tid; Type: DEFAULT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY types ALTER COLUMN tid SET DEFAULT nextval('types_tid_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: reds_web
--

COPY accounts (aid, alias, auth, asalt, vault, vec, modified) FROM stdin;
\.


--
-- Data for Name: domains; Type: TABLE DATA; Schema: public; Owner: reds_web
--

COPY domains (did, pid) FROM stdin;
\.


--
-- Name: domains_did_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_web
--

SELECT pg_catalog.setval('domains_did_seq', 1, false);


--
-- Data for Name: entities; Type: TABLE DATA; Schema: public; Owner: reds_web
--

COPY entities (eid, tid, did) FROM stdin;
\.


--
-- Name: entities_eid_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_web
--

SELECT pg_catalog.setval('entities_eid_seq', 1, false);


--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: reds_web
--

COPY invitations (iid, did, "timestamp") FROM stdin;
\.


--
-- Data for Name: pods; Type: TABLE DATA; Schema: public; Owner: reds_web
--

COPY pods (pid, url, nid, auth) FROM stdin;
\.


--
-- Name: pods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_web
--

SELECT pg_catalog.setval('pods_id_seq', 1, false);


--
-- Data for Name: relations; Type: TABLE DATA; Schema: public; Owner: reds_web
--

COPY relations (parent, child, hard) FROM stdin;
\.


--
-- Data for Name: types; Type: TABLE DATA; Schema: public; Owner: reds_web
--

COPY types (tid, name) FROM stdin;
1	contact
2	address
\.


--
-- Name: types_tid_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_web
--

SELECT pg_catalog.setval('types_tid_seq', 2, true);


--
-- Name: user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_web
--

SELECT pg_catalog.setval('user_id_seq', 1, false);


--
-- Name: accounts_alias; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY accounts
    ADD CONSTRAINT accounts_alias UNIQUE (alias);


--
-- Name: accounts_id; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY accounts
    ADD CONSTRAINT accounts_id PRIMARY KEY (aid);


--
-- Name: domains_did; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY domains
    ADD CONSTRAINT domains_did PRIMARY KEY (did);


--
-- Name: entities_eid; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY entities
    ADD CONSTRAINT entities_eid PRIMARY KEY (eid);


--
-- Name: invitations_iid; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY invitations
    ADD CONSTRAINT invitations_iid PRIMARY KEY (iid);


--
-- Name: pods_id; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY pods
    ADD CONSTRAINT pods_id PRIMARY KEY (pid);


--
-- Name: relations_parent_child; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY relations
    ADD CONSTRAINT relations_parent_child PRIMARY KEY (parent, child);


--
-- Name: types_tid; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY types
    ADD CONSTRAINT types_tid PRIMARY KEY (tid);


--
-- Name: after_delete_entity_trigger; Type: TRIGGER; Schema: public; Owner: reds_web
--

CREATE TRIGGER after_delete_entity_trigger AFTER DELETE ON entities FOR EACH ROW EXECUTE PROCEDURE after_delete_entity();


--
-- Name: after_delete_relation_trigger; Type: TRIGGER; Schema: public; Owner: reds_web
--

CREATE TRIGGER after_delete_relation_trigger AFTER DELETE ON relations FOR EACH ROW EXECUTE PROCEDURE after_delete_relation();


--
-- Name: before_delete_entity_trigger; Type: TRIGGER; Schema: public; Owner: reds_web
--

CREATE TRIGGER before_delete_entity_trigger BEFORE DELETE ON entities FOR EACH ROW EXECUTE PROCEDURE before_delete_entity();


--
-- Name: before_delete_relation_trigger; Type: TRIGGER; Schema: public; Owner: reds_web
--

CREATE TRIGGER before_delete_relation_trigger BEFORE DELETE ON relations FOR EACH ROW EXECUTE PROCEDURE before_delete_relation();


--
-- Name: before_insert_relation_trigger; Type: TRIGGER; Schema: public; Owner: reds_web
--

CREATE TRIGGER before_insert_relation_trigger BEFORE INSERT ON relations FOR EACH ROW EXECUTE PROCEDURE before_insert_relation();


--
-- Name: domains_pid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY domains
    ADD CONSTRAINT domains_pid_fkey FOREIGN KEY (pid) REFERENCES pods(pid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: entities_did_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY entities
    ADD CONSTRAINT entities_did_fkey FOREIGN KEY (did) REFERENCES domains(did) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: entities_tid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY entities
    ADD CONSTRAINT entities_tid_fkey FOREIGN KEY (tid) REFERENCES types(tid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invitations_did_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY invitations
    ADD CONSTRAINT invitations_did_fkey FOREIGN KEY (did) REFERENCES domains(did) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: relations_child_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY relations
    ADD CONSTRAINT relations_child_fkey FOREIGN KEY (child) REFERENCES entities(eid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: relations_parent_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reds_web
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
