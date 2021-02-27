'use strict'
const Chars = require('./chars')

const INTERNAL = Symbol('Scripts_Internal')
let INSTANCE = null

class Scripts {
  constructor(internal) {
    if (internal !== INTERNAL) {
      throw new TypeError(
        'Do not call constructor directly, use Scripts.instance()'
      )
    }
    this.chars = new Chars()
    this.scripts = this.chars.data.scripts.map(v => v[0])
    this.scriptMap = this.chars.data.scripts.reduce((t, v) => {
      t[v[0]] = [v[2], v[3]]
      return t
    }, {})
    this.scriptPoints = {}
  }

  static instance() {
    if (!INSTANCE) {
      INSTANCE = new Scripts(INTERNAL)
    }
    return INSTANCE
  }

  get(script, filter) {
    if (!script) {
      throw new TypeError('no script')
    }
    let sc = this.scriptPoints[script]
    if (!sc) {
      this.scriptPoints[script] = sc = []
      // TODO: find a more economical way to walk the trie
      const map = this.scriptMap[script]
      if (!map) {
        throw new Error(`Unknown script: "${script}"`)
      }
      const [first, last] = map
      for (let i = first; i <= last; i++) {
        const c = this.chars.get(i)
        if (c && (c.script === script)) {
          sc.push(c)
        }
      }
    }
    if (filter != null) {
      if (typeof filter === 'boolean') {
        if (filter) {
          return sc.filter(c => c.property === 'PVALID')
        }
      } else {
        return sc.filter(({category}) => filter.includes(category))
      }
    }
    return sc
  }
}

module.exports = Scripts
