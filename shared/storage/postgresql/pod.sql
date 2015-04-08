
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
-- Name: nodes; Type: TABLE; Schema: public; Owner: reds_web; Tablespace: 
--

CREATE TABLE nodes (
    nid integer NOT NULL,
    namespace character varying(256) NOT NULL,
    pid smallint NOT NULL,
    auth bytea NOT NULL
);


-- ALTER TABLE public.nodes OWNER TO reds_web;

--
-- Name: nodes_nid_seq; Type: SEQUENCE; Schema: public; Owner: reds_web
--

CREATE SEQUENCE nodes_nid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER TABLE public.nodes_nid_seq OWNER TO reds_web;

--
-- Name: nodes_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reds_web
--

ALTER SEQUENCE nodes_nid_seq OWNED BY nodes.nid;


--
-- Name: nid; Type: DEFAULT; Schema: public; Owner: reds_web
--

ALTER TABLE ONLY nodes ALTER COLUMN nid SET DEFAULT nextval('nodes_nid_seq'::regclass);


--
-- Data for Name: nodes; Type: TABLE DATA; Schema: public; Owner: reds_web
--

COPY nodes (nid, namespace, pid, auth) FROM stdin;
\.


--
-- Name: nodes_nid_seq; Type: SEQUENCE SET; Schema: public; Owner: reds_web
--

SELECT pg_catalog.setval('nodes_nid_seq', 1, false);


--
-- Name: nodes_namespace; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY nodes
    ADD CONSTRAINT nodes_namespace UNIQUE (namespace);


--
-- Name: nodes_nid; Type: CONSTRAINT; Schema: public; Owner: reds_web; Tablespace: 
--

ALTER TABLE ONLY nodes
    ADD CONSTRAINT nodes_nid PRIMARY KEY (nid);


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
