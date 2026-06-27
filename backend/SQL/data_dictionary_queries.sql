create or replace view data_dictionary_objects_v
as
select
	c.relname as object_name,
	pg_catalog.obj_description(c.oid, 'pg_class') as object_description,
	a.attnum as column_position,
	a.attname as column_name,
	--determine if this is a primary key
	exists(select 1
		from pg_catalog.pg_constraint as pk
		where pk.conrelid = c.oid
		  and pk.contype = 'p'
		  and a.attnum = any(pk.conkey)
	) as is_primary_key,
	pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
	not a.attnotnull as is_nullable,
	case
		when a.attidentity in ('a', 'd') then true
		else false end
	as is_identity,
	pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) as column_default,
	pg_catalog.col_description(c.oid, a.attnum) as column_description
    from pg_catalog.pg_attribute as a
	join pg_catalog.pg_class as c
        on c.oid = a.attrelid
	join pg_catalog.pg_namespace as n
        on n.oid = c.relnamespace
    left join pg_catalog.pg_attrdef as ad
        on ad.adrelid = a.attrelid
        and ad.adnum = a.attnum
    where c.relkind in ('r', 'p', 'v', 'm')  -- regular and partitioned tables
    and a.attnum > 0
	and not a.attisdropped
	and n.nspname not in ('pg_catalog', 'information_schema')
	-- optional for a typical class project:
	-- and n.nspname = 'public'
	and c.relname <> 'alembic_version'
	order by object_name, column_position;

comment on view data_dictionary_objects_v is
'Data Dictionary View for the Object (Table, View, Materialized Views) and Column metadata';
comment on column data_dictionary_objects_v.object_name is
'The name of the object (table, view, materialized view)';
comment on column data_dictionary_objects_v.object_description is
'The object''s description';
comment on column data_dictionary_objects_v.column_position is
'The relative column position with respect to the object';
comment on column data_dictionary_objects_v.is_primary_key is
'A boolean column to indicate if the corresponding column_name is a primary key column (true) or not (false)';
comment on column data_dictionary_objects_v.data_type is
'The column data type';
comment on column data_dictionary_objects_v.is_nullable is
'A boolean column to indicate if the corresponding column can container null (true) or not (false)';
comment on column data_dictionary_objects_v.is_identity is
'A boolean column to indicate if the corresponding column is an identity column (true) or not (false)';
comment on column data_dictionary_objects_v.column_default is
'The default value for the column';
comment on column data_dictionary_objects_v.column_description is
'The column''s description';
comment on column data_dictionary_objects_v.column_name is
'The column''s name';


CREATE OR REPLACE VIEW 
data_dictionary_relationships_v
AS SELECT
    source_table.relname AS source_table,
    source_column.attname AS source_column,
    fk.conname AS foreign_key_name,
    referenced_table.relname AS referenced_table,
    referenced_column.attname AS referenced_column
FROM pg_catalog.pg_constraint AS fk
JOIN pg_catalog.pg_class AS source_table
    ON source_table.oid = fk.conrelid
    AND source_table.relkind IN ('r', 'p')  -- tables only
JOIN pg_catalog.pg_namespace AS source_schema
    ON source_schema.oid = source_table.relnamespace
JOIN pg_catalog.pg_class AS referenced_table
    ON referenced_table.oid = fk.confrelid
    AND referenced_table.relkind IN ('r', 'p')  -- tables only
JOIN pg_catalog.pg_namespace AS referenced_schema
    ON referenced_schema.oid = referenced_table.relnamespace
-- Referencing/source foreign-key column
JOIN LATERAL unnest(fk.conkey)
    WITH ORDINALITY AS source_key(attnum, ordinality)
    ON TRUE
-- Matching referenced column, preserving composite-key order
JOIN LATERAL unnest(fk.confkey)
    WITH ORDINALITY AS referenced_key(attnum, ordinality)
    ON referenced_key.ordinality = source_key.ordinality
JOIN pg_catalog.pg_attribute AS source_column
    ON source_column.attrelid = fk.conrelid
    AND source_column.attnum = source_key.attnum
JOIN pg_catalog.pg_attribute AS referenced_column
    ON referenced_column.attrelid = fk.confrelid
    AND referenced_column.attnum = referenced_key.attnum
WHERE fk.contype = 'f'
  AND source_schema.nspname NOT IN ('pg_catalog', 'information_schema')
  AND source_table.relname <> 'alembic_version'
ORDER BY
    source_schema.nspname,
    source_table.relname,
    fk.conname,
    source_key.ordinality;

comment on view data_dictionary_relationships_v is
'Data Dictionary View for the foreign key relationships between tables';
COMMENT ON COLUMN data_dictionary_relationships_v.source_table IS 'The name of the source table that references the referenced_table';
COMMENT ON COLUMN data_dictionary_relationships_v.source_column IS 'The name of the source table column that references the referenced_column in the referenced_table';
COMMENT ON COLUMN data_dictionary_relationships_v.foreign_key_name IS 'The name of the foreign key constraint name defined in the source_table';
COMMENT ON COLUMN data_dictionary_relationships_v.referenced_table IS 'The name of the table that is referenced by the source_table''s foreign key constraint';
COMMENT ON COLUMN data_dictionary_relationships_v.referenced_column IS 'The name of the table column that is referenced by the source_table''s source_column foreign key constraint';
