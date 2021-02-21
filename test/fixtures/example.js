'use strict'

module.exports = [
  undefined,
  NaN,
  true,
  false,
  -Infinity,
  0,
  1,
  1.1,
  "foo",
  {
    one: 2,
    three: 4
  },
  0n,
  -127n,
  65536n,
  Symbol.for('Sym'),
  new Map([['a', 'one'], ['foo', false]]),
  new Set([2, true, 'foo'])
]
