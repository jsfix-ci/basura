'use strict'

const Basura = require('../../lib/index')
const scripts = require('../../scripts')

const INFINITIES = [-Infinity, Infinity]

/**
 * Un-generate garbage.  Inverse of Basura, for creating test cases.
 */
class Arusab  extends Basura {
  constructor (opts) {
    super(opts)
  }

  _randBytes (bytes, reason = 'unspecified') {
    this.record.push([bytes, `${reason}:${bytes.length}`])
  }

  _randUInt32 (i, reason = 'unspecified') {
    const b = Buffer.alloc(4)
    b.writeUInt32BE(i)
    this._randBytes(b, `_randUInt32,${reason}`)
  }

  _upto (num, i, reason = 'unspecified') {
    this._randUInt32(i, `_upto(${num}),${reason}`)
  }

  _pick (ary, m, reason = 'unspecified') {
    const i = ary.indexOf(m)
    if (i === -1) {
      throw new Error(`not found: ${m} in ${ary}`, {ary, m, reason})
    }
    this._upto(ary.length, i, `_pick(${ary.length}),${reason}`)
  }

  _getScript (s) {
    const cp = s.codePointAt(0)
    for (const script of this.opts.scripts) {
      if (cp in scripts[script]) {
        return script
      }
    }
    return null
  }

  generate_boolean (b) {
    this._upto(2, b, 'boolean')
  }

  generate_Integer (i) {
    this._randUInt32(i + 0x7FFFFFFF, 'integer')
  }

  generate_number (n) {
    const b = Buffer.alloc(8)
    b.writeDoubleBE(n)
    this._randBytes(b, 'number')
  }

  generate_Infinity (i) {
    this._pick(INFINITIES, i, 'Infinity')
  }

  generate_string (txt, reason = 'string') {
    const script = this._getScript(txt)
    if (!script) {
      throw new Error(`Script not found for ${txt.codePointAt(0)}`)
    }
    this._pick(this.opts.scripts, script, `script,${reason}`)
    const points = scripts[script]
    const len = txt.length
    this._upto(this.opts.strlen, len, `strlen,${reason}`)
    for (let i = 0; i < len; i++) {
      this._pick(Object.keys(points), txt.codePointAt(i).toString() , `codepoint,${reason}`)
    }
  }

  generate_Array (a, depth = 0) {
    const len = a.length
    this._upto(this.opts.arraylen, len, 'arraylen')
    for (const i of a) {
      this.generate(i, depth + 1)
    }
  }

  generate_object (obj, depth = 0) {
    const keys = Object.keys(obj)
    const len = keys.length
    this._upto(this.opts.arraylen, len, 'objectlen')
    for (let i = 0; i < len; i++) {
      this.generate_string(keys[i], 'key')
      this.generate(obj[keys[i]], depth + 1)
    }
  }

  generate_bigint (n) {
    let neg = false
    if (n < 0) {
      n *= -1n
      neg = true
    }
    let str = n.toString(16)
    if (str.length % 2 !== 0) {
      str = '0' + str
    }
    let buf = Buffer.from(str, 'hex')
    this._upto(this.opts.strlen - 1, buf.length - 1, 'bigintlen')
    this._randBytes(buf, 'bigint')
    this.generate_boolean(neg)
  }

  generate_symbol (s) {
    const name = s.toString().match(/^Symbol\((.*)\)$/)[1]
    this.generate_string(name, 'symbol')
  }

  generate_Map (m, depth = 0) {
    this._upto(this.opts.arraylen, m.size, 'maplen')
    for (const [k, v] of m.entries()) {
      this.generate_string(k, 'key')
      this.generate(v, depth + 1)
    }
  }

  generate_Set (s, depth = 0) {
    this._upto(this.opts.arraylen, s.size, 'setlen')
    for (const o of s) {
      this.generate(o, depth + 1)
    }
  }

  generate (o, depth = 0) {
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
          typ = 'Integer'
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
    f.call(this, o, depth + 1, )
  }
}

module.exports = Arusab

if (require.main === module) {
  const path = require('path')
  const f = path.resolve(process.cwd(), process.argv[2])
  const inp = require(f)
  const u = new Arusab ()
  u.generate(inp)
  const out = JSON.stringify(
    u.record.map(([b, r]) => [b.toString('hex'), r]),
      null,
      2)
  console.log(out)
}
