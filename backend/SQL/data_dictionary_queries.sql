create or replace view data_dictionary_objects_v
as
select
    c.relname as object_name,
    pg_catalog.obj_description(c.oid, 'pg_class') as object_description,
    a.attnum as column_position,
    a.attname as column_name,
    --determine if this is a primary key
    exists(
        select 1
        from pg_catalog.pg_constraint as pk
        where
            pk.conrelid = c.oid
            and pk.contype = 'p'
            and a.attnum = any(pk.conkey)
    ) as is_primary_key,
    pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
    not a.attnotnull as is_nullable,
    coalesce(a.attidentity in ('a', 'd'), false) as is_identity,
    pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) as column_default,
    pg_catalog.col_description(c.oid, a.attnum) as column_description
from pg_catalog.pg_attribute as a
inner join pg_catalog.pg_class as c
    on c.oid = a.attrelid
inner join pg_catalog.pg_namespace as n
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


create or replace view
data_dictionary_relationships_v
as select
    source_table.relname as source_table,
    source_column.attname as source_column,
    fk.conname as foreign_key_name,
    referenced_table.relname as referenced_table,
    referenced_column.attname as referenced_column
from pg_catalog.pg_constraint as fk
inner join pg_catalog.pg_class as source_table
    on source_table.oid = fk.conrelid
        and source_table.relkind in ('r', 'p')  -- tables only
inner join pg_catalog.pg_namespace as source_schema
    on source_schema.oid = source_table.relnamespace
inner join pg_catalog.pg_class as referenced_table
    on referenced_table.oid = fk.confrelid
        and referenced_table.relkind in ('r', 'p')  -- tables only
inner join pg_catalog.pg_namespace as referenced_schema
    on referenced_schema.oid = referenced_table.relnamespace
-- referencing/source foreign-key column
inner join lateral unnest(fk.conkey)
    with ordinality as source_key (attnum, ordinality)
    on true
-- matching referenced column, preserving composite-key order
inner join lateral unnest(fk.confkey)
    with ordinality as referenced_key (attnum, ordinality)
    on referenced_key.ordinality = source_key.ordinality
inner join pg_catalog.pg_attribute as source_column
    on source_column.attrelid = fk.conrelid
        and source_column.attnum = source_key.attnum
inner join pg_catalog.pg_attribute as referenced_column
    on referenced_column.attrelid = fk.confrelid
        and referenced_column.attnum = referenced_key.attnum
where fk.contype = 'f'
    and source_schema.nspname not in ('pg_catalog', 'information_schema')
    and source_table.relname <> 'alembic_version'
order by
    source_schema.nspname,
    source_table.relname,
    fk.conname,
    source_key.ordinality;
comment on view data_dictionary_relationships_v is
'data dictionary view for the foreign key relationships between tables';
comment on column data_dictionary_relationships_v.source_table is
'the name of the source table that references the referenced_table';
comment on column data_dictionary_relationships_v.source_column is
'the name of the source table column that references the referenced_column in the referenced_table';
comment on column data_dictionary_relationships_v.foreign_key_name is
'the name of the foreign key constraint name defined in the source_table';
comment on column data_dictionary_relationships_v.referenced_table is
'the name of the table that is referenced by the source_table''s foreign key constraint';
comment on column data_dictionary_relationships_v.referenced_column is
'the name of the table column that is referenced by the source_table''s source_column foreign key constraint';
