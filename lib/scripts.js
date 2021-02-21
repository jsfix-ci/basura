'use strict'
const path = require('path')
const fs = require('fs')
const punycode = require('punycode/')
const Chars = require('./chars')

class Scripts {
  constructor() {
    this.chars = new Chars()
    this.scripts = this.chars.data.scripts.map(v => v[0])
    this.scriptMap = this.chars.data.scripts.reduce((t, v) => {
      t[v[0]] = [v[1], v[2]]
      return t
    }, {})
    this.scriptPoints = {}
    this.tlds = []

    const filename = path.join(__dirname, '..', 'data', 'tld.txt')
    const lines = fs.readFileSync(filename, 'utf8')
      .split('\n')
      .filter(l => l[0] !== '#')
    for (const line of lines) {
      const puny = line.toString('utf8').toLowerCase()
      const tld = punycode.toUnicode(puny)
      let script = 'Latin'
      for (const c of [...tld]) {
        const char = this.chars.get(c.charCodeAt(0))
        if (char && char.script) {
          ({script} = char)
          break
        }
      }
      this.tlds.push({
        puny,
        tld,
        script
      })
    }
  }

  get(script, filter) {
    if (!script) {
      throw new TypeError('no script')
    }
    let sc = this.scriptPoints[script]
    if (!sc) {
      this.scriptPoints[script] = sc = []
      // TODO: find a more economical way to walk the trie
      const [first, last] = this.scriptMap[script]
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
        return sc.filter(c => filter.includes(c))
      }
    }
    return sc
  }
}

module.exports = Scripts
