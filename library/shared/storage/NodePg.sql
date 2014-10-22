-- INFO Setup plperl language

CREATE OR REPLACE FUNCTION plperl_call_handler() RETURNS language_handler AS '$libdir/plperl' LANGUAGE C;
CREATE OR REPLACE FUNCTION plperl_inline_handler(internal) RETURNS void AS '$libdir/plperl' LANGUAGE C;
CREATE OR REPLACE FUNCTION plperl_validator(oid) RETURNS void AS '$libdir/plperl' LANGUAGE C STRICT;
CREATE OR REPLACE TRUSTED PROCEDURAL LANGUAGE plperl HANDLER plperl_call_handler INLINE plperl_inline_handler VALIDATOR plperl_validator;

-- INFO Trash relation and delete relation child

CREATE OR REPLACE FUNCTION is_trashed_relation(integer, integer) RETURNS boolean AS $$
	return (index($_SHARED{trashed_relations}, ':'.$_[0].':'.$_[1].':')!=-1 ? true : false);
$$ LANGUAGE plperl;


CREATE OR REPLACE FUNCTION trash_relation_and_delete_child() RETURNS trigger AS $$
	spi_exec_query("INSERT INTO relations_trash (parent,child) VALUES ($_TD->{old}{parent},$_TD->{old}{child});", 1);
	$_SHARED{trashed_relations} = $_SHARED{trashed_relations}.':'.$_TD->{old}{parent}.':'.$_TD->{old}{child}.':';
	spi_exec_query("DELETE FROM entities WHERE entities.eid = $_TD->{old}{child};", 1);
	return;
$$ LANGUAGE plperl;

DROP TRIGGER IF EXISTS trash_relation_and_delete_child_trigger ON relations;
CREATE TRIGGER trash_relation_and_delete_child_trigger AFTER DELETE ON relations
  FOR EACH ROW EXECUTE PROCEDURE trash_relation_and_delete_child();

-- INFO Trash entity

CREATE OR REPLACE FUNCTION is_trashed_entity(integer) RETURNS boolean AS $$
	return (index($_SHARED{trashed_entities}, ':'.$_[0].':')!=-1 ? true : false);
$$ LANGUAGE plperl;

CREATE OR REPLACE FUNCTION trash_entity() RETURNS TRIGGER AS $$
	spi_exec_query("INSERT INTO entities_trash (eid,tid,did) VALUES ($_TD->{old}{eid},$_TD->{old}{tid},$_TD->{old}{did});", 1);
	$_SHARED{trashed_entities} = $_SHARED{trashed_entities}.':'.$_TD->{old}{eid}.':';
	return;
$$ LANGUAGE plperl;

DROP TRIGGER IF EXISTS trash_entity_trigger ON entities;
CREATE TRIGGER trash_entity_trigger AFTER DELETE ON entities
  FOR EACH ROW EXECUTE PROCEDURE trash_entity();

-- INFO testing

-- NOTE Start the test
INSERT INTO entities (eid,tid,did) VALUES (1,1,1);
INSERT INTO entities (eid,tid,did) VALUES (2,1,1);
INSERT INTO entities (eid,tid,did) VALUES (3,1,1);
INSERT INTO relations (parent,child) VALUES (2,3);
DELETE FROM entities WHERE eid=1;
DELETE FROM entities WHERE eid=2;
DELETE FROM entities WHERE eid=3;
-- NOTE Check results
SELECT is_trashed_entity(0);
SELECT is_trashed_entity(1);
SELECT is_trashed_entity(2);
SELECT is_trashed_entity(3);
SELECT is_trashed_entity(4);
SELECT is_trashed_relation(2,3);
SELECT is_trashed_relation(2,4);
-- NOTE Clean up stuff
TRUNCATE entities_trash RESTART IDENTITY;
TRUNCATE relations_trash;
