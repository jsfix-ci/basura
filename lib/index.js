'use strict'

const crypto = require('crypto')
const util = require('util')
const Scripts = require('./scripts')
const punycode = require('punycode/')
const assert = require('assert')

const INFINITIES = [-Infinity, Infinity]
const DATE_10YEARS = 315569520000
const FAKE_PROXY = Symbol('FakeProxy')

const scripts = Scripts.instance()

function randBytes(size, reason = 'unspecified') {
  return crypto.randomBytes(size)
}

function inspectOpts(options = {}) {
  return {
    ...options,
    depth: options.depth == null ? null : options.depth - 1
  }
}

function inspectMap(depth, options) {
  // eslint-disable-next-line no-invalid-this
  const inner = util.inspect([...this.entries()], inspectOpts(options))
  return `new Map(${inner})`
}

function inspectSet(depth, options) {
  // eslint-disable-next-line no-invalid-this
  const inner = util.inspect([...this.values()], inspectOpts(options))
  return `new Set(${inner})`
}

function inspectTypedArray(depth, options) {
  // eslint-disable-next-line no-invalid-this
  const inner = util.inspect([...this], inspectOpts(options))
  // eslint-disable-next-line no-invalid-this
  return `new ${this.constructor.name}(${inner})`
}

function inspectArrayBuffer(depth, options) {
  // eslint-disable-next-line no-invalid-this
  const inner = util.inspect([...new Uint8Array(this)], inspectOpts(options))
  return `new Uint8Array(${inner}).buffer`
}

function inspectSharedArrayBuffer(depth, options) {
  // eslint-disable-next-line no-invalid-this
  const inner = util.inspect([...new Uint8Array(this)], inspectOpts(options))
  // eslint-disable-next-line no-invalid-this, max-len
  return `(() => { const s = new SharedArrayBuffer(${this.byteLength}); const b = Buffer.from(s); Buffer.from(${inner}).copy(b); return s })()`
}

function inspectDataView(depth, options) {
  const inner = inspectArrayBuffer.call(
    // eslint-disable-next-line no-invalid-this
    this.buffer,
    depth + 1,
    inspectOpts(options)
  )
  return `new DataView(${inner})`
}

function inspectProxy(depth, options) {
  // eslint-disable-next-line no-invalid-this
  const inner = util.inspect(this[FAKE_PROXY], inspectOpts(options))
  return `new Proxy(${inner}, {})`
}

/**
 * Create garbage javascript types for testing
 */
class Basura {
  /**
   * Create some Basura
   *
   * @param {object} [opts={}] - Options
   * @param {number} [opts.depth=20] - Maximum depth of object to create
   * @param {Array<class|string>} [opts.types] - Types to select from
   * @param {boolean} [opts.extra=true] - Try to add other types that may
   *   or may not exist in earlier versions of JavaScript, in addition
   *   to the default set of types.
   */
  constructor(opts = {}) {
    this.opts = {
      depth: 5,
      strlen: 20,
      arraylen: 10,
      cborSafe: false,
      jsonSafe: false,
      types: {},
      scripts: scripts.scripts,
      randBytes,
      output: null,
      ...opts
    }

    this.typedArrays = [
      ArrayBuffer,
      DataView,
      Float32Array, // TODO: sprinkle in some NaN's, -0's and +/- Infinities?
      Float64Array,
      Uint8Array,
      Uint8ClampedArray,
      Int8Array,
      Uint16Array,
      Int16Array,
      Uint32Array,
      Int32Array,
      BigUint64Array,
      BigInt64Array,
      SharedArrayBuffer // keep as last
    ]

    // All of the things that we support, plus things from
    // the options, minus things from the options that the caller
    // wants us to omit (which they signal by passing in null)
    // `this` may be a subclass; make sure to enumerate the whole
    // prototype chain, preferring the implementation from opts, then
    // more-highly-derived classes.
    this.types = this.opts.types
    for (let o = this; o; o = Object.getPrototypeOf(o)) {
      for (const n of Object.getOwnPropertyNames(o).sort()) {
        const m = n.match(/^generate_(.*)/)
        if (m && (typeof(this[n]) === 'function')) {
          if (!(m[1] in this.types)) {
            this.types[m[1]] = this[n]
          }
        }
      }
    }
    for (const [k, v] of Object.entries(this.types)) {
      if (!v) {
        delete this.types[k]
      }
    }

    if (this.opts.cborSafe) {
      // none of these round-trip in CBOR yet.
      delete this.types['Boolean']
      delete this.types['function']
      delete this.types['Function']
      delete this.types['Number']
      delete this.types['Proxy']
      delete this.types['String']
      delete this.types['symbol']
      delete this.types['URLSearchParams']
      delete this.types['WeakMap']
      delete this.types['WeakSet']
      this.typedArrays.pop() // remove SharedArrayBuffer
    }

    if (this.opts.jsonSafe) {
      // none of these round-trip in JSON
      delete this.types['bigint']
      delete this.types['Boolean']
      delete this.types['Buffer']
      delete this.types['Date']
      delete this.types['function']
      delete this.types['Function']
      delete this.types['Infinity']
      delete this.types['Map']
      delete this.types['NaN']
      delete this.types['Number']
      delete this.types['Proxy']
      delete this.types['RegExp']
      delete this.types['Set']
      delete this.types['String']
      delete this.types['symbol']
      delete this.types['TypedArray']
      delete this.types['undefined']
      delete this.types['URL']
      delete this.types['URLSearchParams']
      delete this.types['WeakMap']
      delete this.types['WeakSet']
    }

    this.typeNames = Object.keys(this.types).sort()
  }

  _randBytes(num, reason = 'unspecified') {
    return this.opts.randBytes(num, reason)
  }

  _randUInt32(reason = 'unspecified') {
    return this._randBytes(4, `_randUInt32,${reason}`).readUInt32BE(0)
  }

  _randUBigInt(bytes = -1, reason = 'unspecified') {
    const len = (bytes === -1) ?
      this._upto(this.opts.strlen - 1, `_randUBigInt len,${reason}`) + 1 :
      bytes
    return BigInt(
      '0x' + this._randBytes(len, `_randUBigInt,${reason}`).toString('hex')
    )
  }

  _random01(reason = 'unspecified') {
    const buf = this._randBytes(8, `_random01,${reason}`)
    // little-endian float64.  Set sign bit to 0, and exponent to 511
    // (1.0 + mantissa).  This avoids subnormals etc.
    buf[6] |= 0xf0
    buf[7] = 0x3f
    return new DataView(buf.buffer).getFloat64(0, true) - 1.0
  }

  _randomGauss(mean, stdDev, reason = 'unspecified') {
    // See: https://stackoverflow.com/a/60476586/8388 or
    // Section 3.4.1 of Donald Knuth's book The Art of Computer Programming
    let v1 = 0
    let v2 = 0
    let s = 0
    do {
      const u1 = this._random01(reason)
      const u2 = this._random01(reason)
      v1 = (2 * u1) - 1
      v2 = (2 * u2) - 1
      s = (v1 * v1) + (v2 * v2)
    } while (s >= 1)

    if (s === 0) {
      return 0
    }

    return mean + (stdDev * (v1 * Math.sqrt(-2.0 * Math.log(s) / s)))
  }

  _upto(num, reason = 'unspecified') {
    return (this._randUInt32(`_upto(${num}),${reason}`) % num)
  }

  _pick(ary, reason = 'unspecified') {
    return ary[this._upto(ary.length, `_pick(${ary.length}),${reason}`)]
  }

  _some(ary, reason = 'unspecified') {
    const ret = Array.prototype.filter.call(ary, () => this._upto(2, reason))
    return (typeof ary === 'string') ? ret.join('') : ret
  }

  // eslint-disable-next-line class-methods-use-this
  generate_undefined(depth = 0) {
    return undefined
  }

  // eslint-disable-next-line class-methods-use-this
  generate_NaN(depth = 0) {
    return NaN
  }

  generate_boolean(depth = 0) {
    return Boolean(this._upto(2, 'boolean'))
  }

  generate_Boolean(depth = 0) {
    // eslint-disable-next-line no-new-wrappers
    const n = new Boolean(this._upto(2, 'boolean'))
    if (this.opts.output) {
      n[util.inspect.custom] = () => `new Boolean(${n.valueOf()})`
    }
    return n
  }

  generate_integer(depth = 0) {
    return this._randUInt32('integer') - 0x7FFFFFFF
  }

  generate_number(depth = 0) {
    let n = Infinity
    while (isNaN(n) || !isFinite(n)) {
      n = this._randBytes(8, 'number').readDoubleBE(0)
    }
    return n
  }

  generate_Number(depth = 0) {
    // eslint-disable-next-line no-new-wrappers
    const n = new Number(this.generate_number())
    if (this.opts.output) {
      n[util.inspect.custom] = () => `new Number(${n.valueOf()})`
    }
    return n
  }

  generate_Infinity(depth = 0) {
    return this._pick(INFINITIES, 'Infinity')
  }

  generate_Buffer(depth = 0) {
    if (depth > this.opts.depth) {
      return Buffer.alloc(0)
    }
    const buf = this._randBytes(this.opts.strlen, 'Buffer')
    if (this.opts.output) {
      buf[util.inspect.custom] =
        () => `Buffer.from('${buf.toString('hex')}', 'hex')`
    }
    return buf
  }

  generate_string(depth = 0, reason = 'string') {
    const script = this._pick(this.opts.scripts, `script,${reason}`)
    const points = scripts.get(script)
    const str = []
    const len = this._upto(this.opts.strlen, `strlen,${reason}`)
    for (let i = 0; i < len;) {
      const point = this._pick(points, `codepoint,${reason}`)
      if (i === 0) {
        if (point.category !== 'Mn') {
          str.push(point.code)
          i++
        }
      } else {
        str.push(point.code)
        i++
      }
    }
    return String.fromCodePoint(...str)
  }

  generate_String(depth = 0, reason = 'String') {
    // eslint-disable-next-line no-new-wrappers
    const n = new String(this.generate_string(depth, reason))
    if (this.opts.output) {
      n[util.inspect.custom] = () => `new String('${n.valueOf()}')`
    }
    return n
  }

  generate_RegExp(depth = 0, reason = 'RegExp') {
    const n = new RegExp(
      this.generate_string(depth, reason),
      this._some('gimsuy', reason)
    )
    if (this.opts.output) {
      n[util.inspect.custom] = () => `new RegExp('${n.source}', '${n.flags}')`
    }
    return n
  }

  generate_URL(depth = 0, reason = 'URL') {
    const proto = this._upto(2, 'URL proto') ? 'http' : 'https'
    const tld = this._pick(scripts.tlds, 'URL tld')

    const str = []
    const points = scripts.get(tld.script, true)
    const lowercase = points.filter(
      c => ['Ll', 'Lo', 'Lm'].includes(c.category)
    )
    assert(lowercase.length > 0)

    // first codepoint lowercase-ish
    str.push(this._pick(lowercase, `copdepoint1,${reason}`).code)

    const more = points.filter(
      c => ['Ll', 'Lm', 'Lo', 'Nd', 'Mn', 'Mc'].includes(c.category)
    )
    const len = this._upto(this.opts.strlen - 1, `strlen,${reason}`)
    for (let i = 0; i < len; i++) {
      str.push(this._pick(more, `codepoint,${reason}`).code)
    }

    const tu = String.fromCodePoint(...str).normalize('NFC')
    const tld1 = punycode.toASCII(tu)
    try {
      const u = new URL(`${proto}://${tld1}.${tld.puny}/`)
      if (this.opts.output) {
        u[util.inspect.custom] = () => `new URL('${u.toString()}')`
      }
      return u
    } catch (e) {
      e.unicode = `${proto}://${tu}.${tld.tld}/`
      e.str = str
      throw e
    }
  }

  generate_Array(depth = 0) {
    if (depth > this.opts.depth) {
      return []
    }
    const a = []
    const len = this._upto(this.opts.arraylen, 'arraylen')
    for (let i = 0; i < len; i++) {
      a.push(this.generate(depth + 1))
    }
    return a
  }

  generate_TypedArray(depth = 0) {
    const Type = this._pick(this.typedArrays, 'TypedArray type')
    const nm = Type.name
    const len = (depth > this.opts.depth) ?
      0 :
      this._upto(this.opts.arraylen, `${nm} len`)
    const sz = Type.BYTES_PER_ELEMENT || 1
    const buf = this._randBytes(sz * len, nm)

    let ab = null
    let inspect = null
    switch (Type) {
      case ArrayBuffer:
        ab = buf.buffer.slice(
          buf.byteOffset,
          buf.byteOffset + buf.byteLength
        )
        inspect = inspectArrayBuffer
        break
      case SharedArrayBuffer: {
        ab = new SharedArrayBuffer(buf.byteLength)
        const bsab = Buffer.from(ab)
        buf.copy(bsab)
        inspect = inspectSharedArrayBuffer
        break
      }
      case DataView:
        ab = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
        inspect = inspectDataView
        break
      default:
        ab = new Type(buf.buffer, buf.byteOffset, len)
        inspect = inspectTypedArray
        break
    }

    if (this.opts.output) {
      ab[util.inspect.custom] = inspect
    }
    return ab
  }

  generate_object(depth = 0) {
    if (depth > this.opts.depth) {
      return null
    }
    const o = {}
    const len = this._upto(this.opts.arraylen, 'objectlen')
    for (let i = 0; i < len; i++) {
      o[this.generate_string(depth + 1, 'key')] = this.generate(depth + 1)
    }
    return o
  }

  generate_bigint(depth = 0) {
    let bi = this._randUBigInt(-1, 'signed')
    if (this.generate_boolean(depth + 1)) {
      bi *= -1n
    }
    return bi
  }

  generate_Date(depth = 0, today = null) {
    // A Number can exactly represent all integers from -9,007,199,254,740,992
    // to 9,007,199,254,740,992 (20.1.2.8 and 20.1.2.6). A time value supports
    // a slightly smaller range of -8,640,000,000,000,000 to
    // 8,640,000,000,000,000 milliseconds. This yields a supported time value
    // range of exactly -100,000,000 days to 100,000,000 days relative to
    // midnight at the beginning of 01 January, 1970 UTC.

    // Normally distribute the dates around today, with a standard deviation
    // of 10 years
    if (!today) {
      today = new Date()
    }
    const n = this._randomGauss(today.getTime(), DATE_10YEARS, 'date')
    return new Date(n)
  }

  generate_symbol(depth = 0) {
    return Symbol.for(this.generate_string(depth + 1, 'symbol'))
  }

  generate_Map(depth = 0) {
    if (depth > this.opts.depth) {
      return null
    }
    const m = new Map()
    const len = this._upto(this.opts.arraylen, 'maplen')
    for (let i = 0; i < len; i++) {
      m.set(this.generate(depth + 1), this.generate(depth + 1))
    }
    if (this.opts.output) {
      m[util.inspect.custom] = inspectMap
    }
    return m
  }

  generate_Proxy(depth = 0) {
    if (depth > this.opts.depth) {
      return null
    }

    const o = this.generate_object(depth) // not +1.  Can't use a null.
    if (this.opts.output) {
      const p = {
        [FAKE_PROXY]: o
      }
      p[util.inspect.custom] = inspectProxy
      return p
    }
    return new Proxy(o, {})
  }

  generate_Set(depth = 0) {
    if (depth > this.opts.depth) {
      return null
    }
    const s = new Set()
    const len = this._upto(this.opts.arraylen, 'setlen')
    for (let i = 0; i < len; i++) {
      s.add(this.generate(depth + 1))
    }
    if (this.opts.output) {
      s[util.inspect.custom] = inspectSet
    }
    return s
  }

  generate_function(depth = 0) {
    if (depth > this.opts.depth) {
      return null
    }
    const val = this.generate_string(depth, 'function')

    // This keeps v8 from finding the function name
    const o = {}
    o.aFunction = this._upto(2, 'function async') ?
      () => val :
      // eslint-disable-next-line no-return-await
      async() => await val

    if (this.opts.output) {
      o.aFunction[util.inspect.custom] =
        () => o.aFunction.toString().replace('val', `'${val}'`)
    }
    return o.aFunction
  }

  generate_Function(depth = 0) {
    if (depth > this.opts.depth) {
      return null
    }
    const val = this.generate_string(depth, 'function')
    if (this._upto(2, 'Function async')) {
      const f = new Function(`return '${val}'`)
      if (this.opts.output) {
        f[util.inspect.custom] = () => `function() { return '${val}' }`
      }
      return f
    }
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
    const f = new AsyncFunction(`return '${val}'`)
    if (this.opts.output) {
      f[util.inspect.custom] = () => `async function() { return '${val}' }`
    }
    return f
  }

  generate(depth = 0) {
    if (depth > this.opts.depth) {
      return null
    }
    const typN = this._pick(this.typeNames, 'type')
    const typ = this.types[typN]
    return typ.call(this, depth + 1)
  }

  static quoteSymbols(str) {
    // this isn't really right.  It misses:
    // Symbol())))
    return str.replace(/Symbol\((.+?)\)/g, 'Symbol(\'$1\')')
  }
}

module.exports = Basura
