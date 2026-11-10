// Copia el núcleo compartido a la carpeta core/ de cada función y registra el hash de cada archivo.
//   node shared/catalyst-core/sync.mjs          copia a todas las funciones
//   node shared/catalyst-core/sync.mjs --check  solo compara; sale con código 1 si alguna copia difiere
// Cada función trae tests/core.test.js, que falla si alguien edita su copia de core/ a mano.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const here = import.meta.dirname
const root = path.resolve(here, '../..')
const targets = JSON.parse(fs.readFileSync(path.join(here, 'targets.json'), 'utf8'))
const files = fs.readdirSync(path.join(here, 'src')).filter(f => f.endsWith('.js')).sort()
// Se ignora CRLF/LF: git en Windows puede convertir los saltos de línea al hacer checkout.
const hash = buffer => crypto.createHash('sha256').update(buffer.toString('utf8').replace(/\r\n/g, '\n')).digest('hex')
const check = process.argv.includes('--check')

const manifest = { source: 'shared/catalyst-core/src', files: {} }
for (const file of files) manifest.files[file] = hash(fs.readFileSync(path.join(here, 'src', file)))
const manifestText = JSON.stringify(manifest, null, 2) + '\n'
const readme = '# core/ — NO EDITAR AQUÍ\n\nCopia de `shared/catalyst-core/src` del repositorio de trabajo (AptusWidgets).\nCualquier cambio se hace allá y se copia con `node shared/catalyst-core/sync.mjs`.\n`tests/core.test.js` falla si esta copia se edita a mano.\n'
const coreTest = fs.readFileSync(path.join(here, 'templates', 'core.test.js'), 'utf8')
const sameText = (file, text) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') === text.replace(/\r\n/g, '\n')

let differences = 0
for (const target of targets) {
  const fnDir = path.join(root, target)
  if (!fs.existsSync(fnDir)) { console.log(`- ${target}: no existe, se omite`); continue }
  const coreDir = path.join(fnDir, 'core')
  const stale = !sameText(path.join(coreDir, 'MANIFEST.json'), manifestText)
    || !sameText(path.join(fnDir, 'tests', 'core.test.js'), coreTest)
    || files.some(f => !fs.existsSync(path.join(coreDir, f)) || hash(fs.readFileSync(path.join(coreDir, f))) !== manifest.files[f])
  if (check) {
    if (stale) { differences++; console.log(`✗ ${target}: core/ desactualizado`) } else console.log(`✓ ${target}`)
    continue
  }
  fs.mkdirSync(coreDir, { recursive: true })
  for (const old of fs.readdirSync(coreDir)) if (old.endsWith('.js') && !files.includes(old)) fs.rmSync(path.join(coreDir, old))
  for (const file of files) fs.copyFileSync(path.join(here, 'src', file), path.join(coreDir, file))
  fs.writeFileSync(path.join(coreDir, 'MANIFEST.json'), manifestText)
  fs.writeFileSync(path.join(coreDir, 'README.md'), readme)
  fs.mkdirSync(path.join(fnDir, 'tests'), { recursive: true })
  fs.writeFileSync(path.join(fnDir, 'tests', 'core.test.js'), coreTest)
  console.log(`${stale ? '↻' : '='} ${target}`)
}
if (check && differences) process.exit(1)
