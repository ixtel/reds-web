-- INFO Setup plperl language

CREATE OR REPLACE FUNCTION plperl_call_handler() RETURNS language_handler AS '$libdir/plperl' LANGUAGE C;
CREATE OR REPLACE FUNCTION plperl_inline_handler(internal) RETURNS void AS '$libdir/plperl' LANGUAGE C;
CREATE OR REPLACE FUNCTION plperl_validator(oid) RETURNS void AS '$libdir/plperl' LANGUAGE C STRICT;
CREATE OR REPLACE TRUSTED PROCEDURAL LANGUAGE plperl HANDLER plperl_call_handler INLINE plperl_inline_handler VALIDATOR plperl_validator;

-- INFO Simulation trigger
-- NOTE Use only for DELETE FROM entities WHERE ... !

CREATE OR REPLACE FUNCTION simulate(text) RETURNS text AS $$
	$_SHARED{simulation_active} = 1;
	spi_exec_query($_[0], 0);
	$_SHARED{simulation_active} = 0;
	chop($_SHARED{simulation_result});
	return $_SHARED{simulation_result};
$$ LANGUAGE plperl;

CREATE OR REPLACE FUNCTION set_cascade_domain(integer) RETURNS text AS $$
	$_SHARED{cascade_domain} = $_[0];
	return $_SHARED{cascade_domain};
$$ LANGUAGE plperl;

-- INFO Entity triggers

CREATE OR REPLACE FUNCTION before_delete_entity() RETURNS TRIGGER AS $$
	if ($_SHARED{cascade_domain} && ($_SHARED{cascade_domain} != $_TD->{old}{did})) {
		return "SKIP";
	}
	if ($_SHARED{simulation_active}) {
		$_SHARED{simulation_result} = $_SHARED{simulation_result}.$_TD->{old}{eid}.",";
		spi_exec_query("DELETE FROM relations WHERE parent = $_TD->{old}{eid}", 1);
		return "SKIP";
	}
	return;
$$ LANGUAGE plperl;
DROP TRIGGER IF EXISTS before_delete_entity_trigger ON entities;
CREATE TRIGGER before_delete_entity_trigger BEFORE DELETE ON entities
  FOR EACH ROW EXECUTE PROCEDURE before_delete_entity();

CREATE OR REPLACE FUNCTION after_delete_entity() RETURNS TRIGGER AS $$
	spi_exec_query("DELETE FROM relations WHERE parent = $_TD->{old}{eid}", 1);
	return;
$$ LANGUAGE plperl;
DROP TRIGGER IF EXISTS after_delete_entity_trigger ON entities;
CREATE TRIGGER after_delete_entity_trigger AFTER DELETE ON entities
  FOR EACH ROW EXECUTE PROCEDURE after_delete_entity();

-- INFO Relation triggers
	
CREATE OR REPLACE FUNCTION before_delete_relation() RETURNS TRIGGER AS $$
	if ($_SHARED{simulation_active}) {
		spi_exec_query("DELETE FROM entities WHERE eid = $_TD->{old}{child}", 1);
		return "SKIP";
	}
	return;
$$ LANGUAGE plperl;
DROP TRIGGER IF EXISTS before_delete_relation_trigger ON relations;
CREATE TRIGGER before_delete_relation_trigger BEFORE DELETE ON relations
  FOR EACH ROW EXECUTE PROCEDURE before_delete_relation();

CREATE OR REPLACE FUNCTION after_delete_relation() RETURNS TRIGGER AS $$
	spi_exec_query("DELETE FROM entities WHERE eid = $_TD->{old}{child}", 1);
	return;
$$ LANGUAGE plperl;
DROP TRIGGER IF EXISTS after_delete_relation_trigger ON relations;
CREATE TRIGGER after_delete_relation_trigger AFTER DELETE ON relations
  FOR EACH ROW EXECUTE PROCEDURE after_delete_relation();

-- INFO Testing

INSERT INTO domains (did,pid) VALUES (1,1);
INSERT INTO domains (did,pid) VALUES (2,1);
INSERT INTO entities (eid,tid,did) VALUES (1,1,1);
INSERT INTO entities (eid,tid,did) VALUES (2,1,1);
INSERT INTO entities (eid,tid,did) VALUES (3,1,1);
INSERT INTO entities (eid,tid,did) VALUES (4,1,1);
INSERT INTO entities (eid,tid,did) VALUES (5,1,2);
INSERT INTO relations (parent,child) VALUES (1,2);
INSERT INTO relations (parent,child) VALUES (1,5);
INSERT INTO relations (parent,child) VALUES (2,3);
INSERT INTO relations (parent,child) VALUES (4,3);
SELECT * FROM domains;
SELECT * FROM entities;
SELECT * FROM relations;

SELECT set_cascade_domain(1);
SELECT simulate('DELETE FROM entities WHERE eid=1');
SELECT * FROM domains;
SELECT * FROM entities;
SELECT * FROM relations;

DELETE FROM entities WHERE eid=1;
SELECT * FROM domains;
SELECT * FROM entities;
SELECT * FROM relations;

TRUNCATE domains RESTART IDENTITY CASCADE;
TRUNCATE entities RESTART IDENTITY CASCADE;
TRUNCATE relations;
