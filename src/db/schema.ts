import { column, Schema, Table } from '@powersync/web'

const records = new Table(
  {
    date: column.text,
    time: column.text,
    text: column.text,
    period: column.text,
    created_at: column.integer,
    updated_at: column.integer,
    deleted_at: column.integer,
  },
  { indexes: { by_date: ['date'] } }
)

const reflections = new Table({
  date: column.text,
  text: column.text,
  updated_at: column.integer,
})

const modules = new Table(
  {
    date: column.text,
    module_id: column.text,
    data: column.text,
    updated_at: column.integer,
    deleted_at: column.integer,
  },
  { indexes: { by_date: ['date'] } }
)

export const AppSchema = new Schema({ records, reflections, modules })

export type Database = (typeof AppSchema)['types']
