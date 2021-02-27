#!/usr/bin/env node
'use strict'

const Basura = require('../lib/index')
const fs = require('fs')
const util = require('util')
const pkg = require('../package.json')
const commander = require('commander')

function myParseInt(value, dummyPrevious) {
  const v = parseInt(value, 10)
  if (isNaN(v)) {
    throw new commander.InvalidOptionArgumentError('Not a number.')
  }
  return v
}

const opts = commander.program
  .version(pkg.version)
  .usage('[options]')
  .description('Generate a random JavaScript object')
  .option(
    '-a, --arrayLength <number>', 'Maximum array/object size', myParseInt, 10
  )
  .option('-c, --cborSafe', 'Do not generate types that break CBOR')
  .option('-d, --depth <number>', 'Maximum depth', myParseInt, 5)
  .option('-j, --json', 'Output JSON')
  .option('-o, --output <file>', 'File to output')
  .option(
    '-s, --stringLength <number>', 'Maximum string length', myParseInt, 20
  )
  .option('-t, --type <type>', 'Generate this specific type')
  .option('-T, --listTypes', 'List all supported types, then exit')
  .addHelpText('after', `
Examples:
  $ basura -t object
  $ basura -t Array -o array.js`)
  .parse(process.argv)
  .opts()

if (opts.json) {
  opts.jsonSafe = true
}

function main() {
  const g = new Basura(opts)

  let obj = null
  if (opts.listTypes) {
    console.log(g.typeNames.join('\n'))
    return
  }

  if (opts.type) {
    const t = opts.type
    delete opts.type
    obj = g[`generate_${t}`].call(g)
  } else {
    obj = g.generate()
  }

  let str = opts.json ?
    JSON.stringify(obj, null, 2) :
    util.inspect(obj, {
      depth: Infinity,
      colors: !opts.output && process.stdout.isTTY
    })
  let out = process.stdout
  if (opts.output) {
    if (opts.output !== '-') {
      out = fs.createWriteStream(opts.output)
    }
    if (!opts.json) {
      out.write(`\
'use strict'
module.exports = `)
      str = Basura.quoteSymbols(str)
    }
  }
  out.write(str)
  out.write('\n')
}

main()
