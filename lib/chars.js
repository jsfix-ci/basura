'use strict'

const fs = require('fs')
const path = require('path')
const UnicodeTrie = require('unicode-trie')

/**
 * Information about all relevant Unicode codepoints.  Irrelevant codepoints
 * include ones that are unassigned, half surrogates, etc.
 */
class Chars {
  /**
   * Construct an instance.  This reads from `data/data.trie` and
   * `data/data.json` synchronously.  Those files are created by
   * `tools/create.js`.
   */
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

  /**
   * Information about a single Unicode codepoint.
   *
   * @typedef {object} CodePoint
   * @property {number} code - codepoint as a number
   * @property {"DISALLOWED"|"PVALID"|"CONTEXTO"|"CONTEXTJ"} property - IDNA
   *   2008 derived property
   * @property {string} script - Script name
   * @property {string} category - General category
   */
  /**
   * Get information about a single codepoint.
   *
   * @param {number} code - the codepoint
   * @return {CodePoint}
   */
  get(code) {
    const x = this.trie.get(code)
    // Thanks to https://github.com/foliojs/unicode-properties for showing me
    // how to do this.

    // x can be invalid (32768), error (65536), or a 15 bit integer
    // with the following fields or'd together:
    // cccccSSSSSSSSpp
    // categoryBits: 5
    // scriptBits: 8
    // propertyBits: 2

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
