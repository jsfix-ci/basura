'use strict'

const test = require('ava')
const Basura = require('../lib/index')

const example = require('./fixtures/example.js')
const bytes = require('./fixtures/example.json')

test('create', async t => {
  const first = await Basura.create()
  t.truthy(first)

  const small = await Basura.create({
    extra: false,
    depth: -1
  })
  const a = small.generate_Array()
  t.deepEqual(a, [])
})

test('constructor edges', async t => {
  const f = await Basura.create()
  const g = await Basura.create({
    types: { Array: null }
  })
  t.not(Object.keys(f.opts.types).length, Object.keys(g.opts.types).length)
  // const h = await Basura.create({
  //   types: []
  // })
})

test('playback', async t => {
  const g = await Basura.create({
    playback: bytes,
    arraylen: 100
  })

  const o = g.generate()
  t.deepEqual(o, example)
})

test('depth', async t => {
  const g = await Basura.create()
  t.is(g.generate(Infinity), null)
  t.is(g.generate_Set(Infinity), null)
  t.is(g.generate_Map(Infinity), null)
  t.is(g.generate_object(Infinity), null)
})

// test('string', t => {
//   const g = await Basura.create()
//   g.generate_string()
// })
