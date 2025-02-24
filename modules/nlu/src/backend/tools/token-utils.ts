import _ from 'lodash'

import { Token2Vec } from '../typings'

import { LATIN_CHARSET, SPECIAL_CHARSET } from './chars'

export const SPACE = '\u2581'

export const isWord = (str: string) => _.every(SPECIAL_CHARSET, c => !RegExp(c).test(str)) && !hasSpace(str)

export const hasSpace = (str: string) => _.some(str, isSpace)

export const isSpace = (str: string) => _.every(str, c => c === SPACE || c === ' ')

export const convertToRealSpaces = (str: string) => str.replace(new RegExp(SPACE, 'g'), ' ')

function splitSpaceToken(token: string): string[] {
  return token.split(new RegExp(`(${SPACE})`, 'g')).filter(_.identity)
}

/**
 * Basically mimics the language server tokenizer. Use this function for testing purposes
 * @param text text you want to tokenize
 */
export function tokenizeLatinTextForTests(text: string): string[] {
  return splitSpaceToken(text.replace(/\s/g, SPACE))
}

type CustomMatcher = (tok: string) => boolean

/**
 * Merges consecutive tokens that all respect the provided regex
 * @param tokens list of string representing a sentence
 * @param charPatterns (string patterns) that **every** characters in a token **can** match
 * @param matcher custom matcher function called on each token
 * @example ['13', 'lo', '34', '56'] with a char pool of numbers ==> ['13', 'lo', '3456']
 * @example ['_', '__', '_', 'abc'] with a char pool of ['_'] ==> ['____', 'abc']
 */
export const mergeSimilarCharsetTokens = (
  tokens: string[],
  charPatterns: string[],
  matcher: CustomMatcher = () => true
): string[] => {
  const charMatcher = new RegExp(`^(${charPatterns.join('|')})+$`, 'i')
  return tokens.reduce((mergedToks: string[], nextTok: string) => {
    const prev = _.last(mergedToks)
    if (prev && charMatcher.test(prev) && charMatcher.test(nextTok) && (matcher(prev) || matcher(nextTok))) {
      return [...mergedToks.slice(0, mergedToks.length - 1), `${_.last(mergedToks) || ''}${nextTok}`]
    } else {
      return [...mergedToks, nextTok]
    }
  }, [])
}

const mergeSpaces = (tokens: string[]): string[] => mergeSimilarCharsetTokens(tokens, [SPACE])
const mergeNumeral = (tokens: string[]): string[] => mergeSimilarCharsetTokens(tokens, ['[0-9]'])
const mergeSpecialChars = (tokens: string[]): string[] => mergeSimilarCharsetTokens(tokens, SPECIAL_CHARSET)
const mergeLatin = (tokens: string[], vocab: Token2Vec): string[] => {
  const oovMatcher = (token: string) => {
    return token && !vocab[token.toLowerCase()]
  }
  return mergeSimilarCharsetTokens(tokens, LATIN_CHARSET, oovMatcher)
}

export const processUtteranceTokens = (tokens: string[], vocab: Token2Vec = {}): string[] => {
  return _.chain(tokens)
    .flatMap(splitSpaceToken)
    .thru(mergeSpaces)
    .thru(mergeNumeral)
    .thru(mergeSpecialChars)
    .thru(tokens => mergeLatin(tokens, vocab))
    .thru(tokens => (tokens.length && tokens[0].startsWith(SPACE) ? tokens.slice(1) : tokens)) // remove 1st token if space, even if input trimmed, sometimes tokenizer returns space char
    .value()
}

export const restoreOriginalUtteranceCasing = (utteranceTokens: string[], utterance: string): string[] => {
  let offset = 0
  return utteranceTokens.map(t => {
    const original = isSpace(t) ? t : utterance.substr(offset, t.length)
    offset += t.length
    return original
  })
}
