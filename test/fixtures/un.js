'use strict'

const Basura = require('../../lib/index')
const Scripts = require('../../lib/scripts')
const scripts = Scripts.instance()

const INFINITIES = [-Infinity, Infinity]

/**
 * Un-generate garbage.  Inverse of Basura, for creating test cases.
 */
class Arusab extends Basura {
  constructor(opts) {
    super(opts)
    this.record = []
  }

  _randBytes(bytes, reason = 'unspecified') {
    this.record.push([bytes, reason])
  }

  _randUInt32(i, reason = 'unspecified') {
    const b = Buffer.alloc(4)
    b.writeUInt32BE(i)
    this._randBytes(b, `_randUInt32,${reason}`)
  }

  _upto(num, i, reason = 'unspecified') {
    this._randUInt32(i, `_upto(${num}),${reason}`)
  }

  _pick(ary, m, reason = 'unspecified') {
    const i = ary.indexOf(m)
    if (i === -1) {
      throw new Error(`not found: ${m} in ${ary}`, {ary, m, reason})
    }
    this._upto(ary.length, i, `_pick(${ary.length}),${reason}`)
  }

  generate_boolean(b) {
    this._upto(2, b, 'boolean')
  }

  generate_integer(i) {
    this._randUInt32(i + 0x7FFFFFFF, 'integer')
  }

  generate_number(n) {
    const b = Buffer.alloc(8)
    b.writeDoubleBE(n)
    this._randBytes(b, 'number')
  }

  generate_Infinity(i) {
    this._pick(INFINITIES, i, 'Infinity')
  }

  generate_string(txt, depth, reason = 'string') {
    const cp = txt.codePointAt(0)
    const { script } = scripts.chars.get(cp)
    this._pick(this.opts.scripts, script, `script,${reason}`)
    const points = scripts.get(script)
    const len = txt.length
    this._upto(this.opts.strlen, len, `strlen,${reason}`)
    const codes = points.map(c => c.code)
    for (const char of [...txt]) {
      this._pick(
        codes,
        char.codePointAt(0),
        `codepoint,${reason}`
      )
    }
  }

  generate_Array(a, depth = 0) {
    const len = a.length
    this._upto(this.opts.arraylen, len, 'arraylen')
    for (const i of a) {
      this.generate(i, depth + 1)
    }
  }

  generate_object(obj, depth = 0) {
    const keys = Object.keys(obj)
    const len = keys.length
    this._upto(this.opts.arraylen, len, 'objectlen')
    for (let i = 0; i < len; i++) {
      this.generate_string(keys[i], depth + 1, 'key')
      this.generate(obj[keys[i]], depth + 1)
    }
  }

  generate_bigint(n) {
    let neg = false
    if (n < 0) {
      n *= -1n
      neg = true
    }
    let str = n.toString(16)
    if (str.length % 2 !== 0) {
      str = '0' + str
    }
    const buf = Buffer.from(str, 'hex')
    this._upto(this.opts.strlen - 1, buf.length - 1, '_randUBigInt len,signed')
    this._randBytes(buf, '_randUBigInt,signed')
    this.generate_boolean(neg)
  }

  generate_symbol(s, depth = 0) {
    const [, name] = s.toString().match(/^Symbol\((.*)\)$/)
    this.generate_string(name, depth + 1, 'symbol')
  }

  generate_Map(m, depth = 0) {
    if (depth > this.opts.depth) {
      return
    }

    this._upto(this.opts.arraylen, m.size, 'maplen')
    for (const [k, v] of m.entries()) {
      this.generate(k, depth + 1)
      this.generate(v, depth + 1)
    }
  }

  generate_Set(s, depth = 0) {
    this._upto(this.opts.arraylen, s.size, 'setlen')
    for (const o of s) {
      this.generate(o, depth + 1)
    }
  }

  generate(o, depth = 0) {
    let typ = typeof o
    switch (typeof o) {
      case 'undefined':
      case 'boolean':
      case 'string':
      case 'bigint':
      case 'symbol':
        break
      case 'number':
        if (isNaN(o)) {
          typ = 'NaN'
        } else if (!Number.isFinite(o)) {
          typ = 'Infinity'
        } else if (Number.isInteger(o)) {
          typ = 'integer'
        }
        break
      case 'object':
        if (!o) {
          typ = 'null'
        } else if (this[`generate_${o.constructor.name}`]) {
          typ = o.constructor.name
        }
        break
      default:
        throw new Error(`Unknown type: "${typeof o}"`)
    }
    this._pick(this.typeNames, typ, 'type')
    const f = this.types[typ]
    if (!f) {
      throw new Error(`invalid type: "${typ}"`)
    }
    f.call(this, o, depth + 1)
  }

  playback(num, reason = 'unspecified') {
    if (!this.record.length) {
      throw new Error(`Out of playback data (${num}): "${reason}"`)
    }
    const [buf, origReason] = this.record.shift()
    if ((buf.length !== num) || (reason !== origReason)) {
      throw new Error(
        `Expected ${num} bytes, got ${buf.length}.  "${reason}" "${origReason}"`
      )
    }
    return buf
  }
}

module.exports = Arusab

if (require.main === module) {
  const path = require('path')
  const f = path.resolve(process.cwd(), process.argv[2])
  const inp = require(f)
  const u = new Arusab()
  u.generate(inp)
  const out = JSON.stringify(
    u.record.map(([b, r]) => [b.toString('hex'), r]),
    null,
    2
  )
  console.log(out)
}
