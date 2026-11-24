#!/usr/bin/env python3
"""Gera o SQL inicial (tabelas, enums, índices, FKs) a partir do schema.prisma.

Uso: python3 scripts/prisma2sql.py prisma/schema.prisma saida.sql
Usa o DMMF (estrutura) + o texto do schema (tipos nativos @db.*).
Segue a convenção de nomes do Prisma (_pkey, _key, _idx, _fkey), para um
`prisma migrate diff` futuro bater com o banco.
Diferenças de propósito (o app usa supabase-js, não o Prisma Client):
  - @default(uuid()) vira gen_random_uuid() no banco
  - @updatedAt vira DEFAULT now() + gatilho set_updated_at (criado em outra migração)
"""
import json, os, re, subprocess, sys

schema_path, out_path = sys.argv[1], sys.argv[2]
src = open(schema_path, encoding='utf-8').read()
dm = json.loads(subprocess.check_output(['node', '-e', '''
const w=require('@prisma/prisma-schema-wasm'),fs=require('fs');
const s=fs.readFileSync(process.argv[1],'utf8');
process.stdout.write(JSON.stringify(JSON.parse(w.get_dmmf(JSON.stringify({prismaSchema:[['schema.prisma',s]]}))).datamodel));
''', schema_path], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# tipos nativos por modelo/campo, lidos do texto
native = {}
for mm in re.finditer(r'^model (\w+) \{(.*?)^\}', src, re.S | re.M):
    for line in mm.group(2).splitlines():
        fm = re.match(r'\s+(\w+)\s+\S+.*?@db\.(\w+)(?:\(([^)]*)\))?', line)
        if fm: native[(mm.group(1), fm.group(1))] = (fm.group(2), fm.group(3))

models = {m['name']: m for m in dm['models']}
def tname(m): return m.get('dbName') or m['name']
def cname(f): return f.get('dbName') or f['name']
def q(x): return '"' + x + '"'

def coltype(m, f):
    nt = native.get((m['name'], f['name']))
    t = f['type']
    if f['kind'] == 'enum': base = q(t)
    elif nt:
        n, a = nt
        base = {'Uuid': 'UUID', 'Inet': 'INET', 'Citext': 'CITEXT', 'Date': 'DATE', 'Text': 'TEXT', 'JsonB': 'JSONB',
                'Timestamptz': f'TIMESTAMPTZ({a or 6})', 'Timestamp': f'TIMESTAMP({a or 3})', 'VarChar': f'VARCHAR({a})',
                'SmallInt': 'SMALLINT', 'Real': 'REAL', 'DoublePrecision': 'DOUBLE PRECISION', 'Decimal': f'DECIMAL({a})'}[n]
    else:
        base = {'String': 'TEXT', 'Int': 'INTEGER', 'BigInt': 'BIGINT', 'Boolean': 'BOOLEAN', 'DateTime': 'TIMESTAMP(3)',
                'Json': 'JSONB', 'Float': 'DOUBLE PRECISION', 'Decimal': 'DECIMAL(65,30)', 'Bytes': 'BYTEA'}[t]
    d = f.get('default')
    if isinstance(d, dict) and d.get('name') == 'autoincrement':
        base = {'INTEGER': 'SERIAL', 'BIGINT': 'BIGSERIAL', 'SMALLINT': 'SMALLSERIAL'}[base]
    return base + ('[]' if f['isList'] else '')

def lit(v, f):
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    if f['kind'] == 'enum': return q(v) if False else f"'{v}'"
    return "'" + str(v).replace("'", "''") + "'"

def default(m, f):
    d = f.get('default')
    if f.get('isUpdatedAt'): return 'CURRENT_TIMESTAMP'
    if d is None: return None
    if isinstance(d, dict):
        n = d['name']
        if n == 'now': return 'CURRENT_TIMESTAMP'
        if n == 'dbgenerated': return d['args'][0]
        if n in ('uuid', 'cuid'): return 'gen_random_uuid()'
        if n == 'autoincrement': return None
        raise SystemExit('default ' + n)
    if isinstance(d, list):
        return 'ARRAY[' + ', '.join(lit(x, f) for x in d) + ']' + ('::' + q(f['type']) + '[]' if f['kind'] == 'enum' else '') \
            if d else "ARRAY[]::" + coltype(m, {**f, 'isList': False, 'default': None}) + '[]'
    return lit(d, f)

out = ['-- Gerado de prisma/schema.prisma por tools/prisma2sql.py. Não edite à mão:',
       '-- mudanças de estrutura entram em uma nova migração.', '',
       'CREATE EXTENSION IF NOT EXISTS "pgcrypto";', 'CREATE EXTENSION IF NOT EXISTS "citext";', '']
for e in dm['enums']:
    out.append(f'CREATE TYPE {q(e.get("dbName") or e["name"])} AS ENUM (' + ', '.join(f"'{v.get('dbName') or v['name']}'" for v in e['values']) + ');')
out.append('')

def fld(m, name): return next(f for f in m['fields'] if f['name'] == name)
idx_by_model = {}
for ix in dm['indexes']: idx_by_model.setdefault(ix['model'], []).append(ix)

fks = []
for m in dm['models']:
    T = tname(m)
    cols = []
    for f in m['fields']:
        if f['kind'] == 'object':
            if f.get('relationFromFields'):
                fks.append((m, f))
            continue
        c = f'    {q(cname(f))} {coltype(m, f)}'
        if f['isRequired'] or f['isList']: c += ' NOT NULL'
        dv = default(m, f)
        if dv is not None: c += f' DEFAULT {dv}'
        cols.append(c)
    for ix in idx_by_model.get(m['name'], []):
        if ix['type'] == 'id':
            cs = [cname(fld(m, x['name'])) for x in ix['fields']]
            cols.append(f'    CONSTRAINT {q(ix.get("dbName") or T + "_pkey")} PRIMARY KEY (' + ', '.join(q(c) for c in cs) + ')')
    out.append(f'CREATE TABLE {q(T)} (\n' + ',\n'.join(cols) + '\n);\n')

for m in dm['models']:
    T = tname(m)
    for ix in idx_by_model.get(m['name'], []):
        if ix['type'] == 'id': continue
        cs = [cname(fld(m, x['name'])) for x in ix['fields']]
        if ix['type'] == 'unique':
            nm = ix.get('dbName') or f'{T}_{"_".join(cs)}_key'
            out.append(f'CREATE UNIQUE INDEX {q(nm)} ON {q(T)}(' + ', '.join(q(c) for c in cs) + ');')
        elif ix['type'] == 'normal':
            nm = ix.get('dbName') or f'{T}_{"_".join(cs)}_idx'
            parts = []
            for x in ix['fields']:
                c = q(cname(fld(m, x['name'])))
                if x.get('sortOrder') == 'desc': c += ' DESC'
                parts.append(c)
            out.append(f'CREATE INDEX {q(nm)} ON {q(T)}(' + ', '.join(parts) + ');')
        else:
            raise SystemExit('index ' + ix['type'])
out.append('')
for m, f in fks:
    T, R = tname(m), models[f['type']]
    fc = [cname(fld(m, x)) for x in f['relationFromFields']]
    tc = [cname(fld(R, x)) for x in f['relationToFields']]
    od = {'Cascade': 'CASCADE', 'SetNull': 'SET NULL', 'Restrict': 'RESTRICT', 'NoAction': 'NO ACTION', 'SetDefault': 'SET DEFAULT'}
    req = all(fld(m, x)['isRequired'] for x in f['relationFromFields'])
    ondel = od.get(f.get('relationOnDelete')) or ('RESTRICT' if req else 'SET NULL')
    nm = f'{T}_{"_".join(fc)}_fkey'
    out.append(f'ALTER TABLE {q(T)} ADD CONSTRAINT {q(nm)} FOREIGN KEY (' + ', '.join(q(c) for c in fc) + f') REFERENCES {q(tname(R))}('
               + ', '.join(q(c) for c in tc) + f') ON DELETE {ondel} ON UPDATE CASCADE;')
open(out_path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(len(dm['models']), 'tabelas,', len(dm['enums']), 'enums,', len(fks), 'FKs')
