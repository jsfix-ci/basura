'use strict'

const test = require('ava')
const Basura = require('../lib/index')

const example = require('./fixtures/example.js')
const Arusab = require('./fixtures/un.js')

test('create', t => {
  const first = new Basura()
  t.truthy(first)

  const small = new Basura({
    extra: false,
    depth: -1
  })
  const a = small.generate_Array()
  t.deepEqual(a, [])
})

test('constructor edges', t => {
  const f = new Basura()
  const g = new Basura({
    types: { Array: null }
  })
  t.not(Object.keys(f.opts.types).length, Object.keys(g.opts.types).length)
  // const h = new Basura({
  //   types: []
  // })
})

test('playback', t => {
  const un = new Arusab({
    arraylen: 100
  })
  un.generate(example)

  const g = new Basura({
    randBytes: un.playback.bind(un),
    arraylen: 100
  })

  const o = g.generate()
  t.deepEqual(o, example)
})

test('depth', t => {
  const g = new Basura()
  t.is(g.generate(Infinity), null)
  t.is(g.generate_Set(Infinity), null)
  t.is(g.generate_Map(Infinity), null)
  t.is(g.generate_object(Infinity), null)
})

// test('string', t => {
//   const g = new Basura()
//   g.generate_string()
// })
