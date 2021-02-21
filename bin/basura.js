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
    '-a, --arraylen <number>', 'Maximum array/object size', myParseInt, 10
  )
  .option('-A, --any', 'Generate any type rather than always being an object')
  .option('-c, --cborSafe', 'Do not generate types that break CBOR')
  .option('-d, --depth <number>', 'Maximum depth', myParseInt, 5)
  .option('-j, --json', 'Output JSON')
  .option('-o, --output <file>', 'File to output')
  .option('-s, --strlen <number>', 'Maximum string length', myParseInt, 20)
  .option('-t, --type <type>', 'Generate this specific type')
  .parse(process.argv)
  .opts()

if (opts.type && opts.any) {
  console.error('--type and --any are mutually exclusive')
  process.exit(1)
}

if (opts.json) {
  opts.jsonSafe = true
}

function main() {
  const g = new Basura(opts)

  let obj = null
  if (opts.type) {
    const t = opts.type
    delete opts.type
    obj = g[`generate_${t}`].call(g)
  } else if (opts.any) {
    delete opts.any
    obj = g.generate()
  } else {
    obj = g.generate_object()
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

main()//.catch(console.error)
