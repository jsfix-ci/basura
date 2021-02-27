'use strict'

const fs = require('fs')
const path = require('path')
const UnicodeTrie = require('unicode-trie')

class Chars {
  constructor() {
    this.trie = new UnicodeTrie(fs.readFileSync(
      path.join(__dirname, '..', 'data', 'data.trie')
    ))
    this.data = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'data', 'data.json')
    ))
    this.propertyMask = (1 << this.data.propertyBits) - 1
    this.categoryMask = (1 << this.data.categoryBits) - 1
    this.scriptMask = (1 << this.data.scriptBits) - 1
  }

  get(code) {
    const x = this.trie.get(code)
    if (x === this.data.invalid) {
      return null
    }
    if (x === this.data.error) {
      throw new Error('Trie error')
    }
    const num = (x >> this.data.scriptShift) & this.scriptMask
    const s = this.data.scripts.find(props => props[1] === num)

    return {
      code,
      property: this.data.properties[
        (x >> this.data.propertyShift) & this.propertyMask
      ],
      category: this.data.categories[
        (x >> this.data.categoryShift) & this.categoryMask
      ],
      script: s[0]
    }
  }
}

module.exports = Chars
