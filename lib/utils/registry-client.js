const npmFetch = require('npm-registry-fetch')
const { webAuthOpener } = require('npm-profile')
const { createOpener } = require('./open-url.js')
const read = require('./read-user-info.js')

/**
 * Registry client that handles OTP prompting transparently for all registry operations
 */
class RegistryClient {
  constructor (npm) {
    this.npm = npm
  }

  /**
   * Perform a registry fetch with automatic OTP handling
   * @param {string} url - Registry URL to fetch
   * @param {object} opts - Options to pass to npm-registry-fetch
   * @returns {Promise} - The fetch response
   */
  async fetch (url, opts = {}) {
    const fullOpts = { ...this.npm.flatOptions, ...opts }
    return this.#withOtpRetry(fullOpts, (o) => npmFetch(url, o))
  }

  /**
   * Perform a registry fetch and automatically parse JSON response
   * @param {string} url - Registry URL to fetch
   * @param {object} opts - Options to pass to npm-registry-fetch
   * @returns {Promise} - The parsed JSON response
   */
  async fetchJson (url, opts = {}) {
    const response = await this.fetch(url, opts)
    return response.json()
  }

  /**
   * Perform a registry POST/PUT with JSON body and automatic content-type header
   * @param {string} url - Registry URL to fetch
   * @param {*} data - Data to JSON.stringify and send as body
   * @param {object} opts - Additional options (method, etc.)
   * @returns {Promise} - The fetch response
   */
  async fetchWithJson (url, data, opts = {}) {
    const jsonOpts = {
      ...opts,
      body: JSON.stringify(data),
      headers: {
        'content-type': 'application/json',
        ...opts.headers,
      },
    }
    return this.fetch(url, jsonOpts)
  }

  /**
   * Perform a registry POST with JSON body and return parsed JSON response
   * @param {string} url - Registry URL to fetch
   * @param {*} data - Data to JSON.stringify and send as body
   * @param {object} opts - Additional options
   * @returns {Promise} - The parsed JSON response
   */
  async postJson (url, data, opts = {}) {
    const response = await this.fetchWithJson(url, data, { method: 'POST', ...opts })
    return response.json()
  }

  /**
   * Perform a registry PUT with JSON body and return parsed JSON response
   * @param {string} url - Registry URL to fetch
   * @param {*} data - Data to JSON.stringify and send as body
   * @param {object} opts - Additional options
   * @returns {Promise} - The parsed JSON response
   */
  async putJson (url, data, opts = {}) {
    const response = await this.fetchWithJson(url, data, { method: 'PUT', ...opts })
    return response.json()
  }

  /**
   * Wrapper for any registry operation that might need OTP
   * @param {function} fn - Function that performs the registry operation
   * @param {object} opts - Options to pass to the function
   * @returns {Promise} - The result of the function
   */
  async withOtp (fn, opts = {}) {
    const fullOpts = { ...this.npm.flatOptions, ...opts }
    return this.#withOtpRetry(fullOpts, fn)
  }

  /**
   * Internal method that handles OTP retry logic
   * @private
   */
  async #withOtpRetry (opts, fn) {
    try {
      return await fn(opts)
    } catch (err) {
      // Only attempt OTP retry if we're in an interactive terminal
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw err
      }

      // Handle web-based OTP flow
      if (err.code === 'EOTP' && err.body?.authUrl && err.body?.doneUrl) {
        const { token: otp } = await webAuthOpener(
          createOpener(this.npm, 'Authenticate your account at'),
          err.body.authUrl,
          err.body.doneUrl,
          opts
        )
        return await fn({ ...opts, otp })
      }

      // Handle classic OTP prompt
      if (err.code === 'EOTP' || (err.code === 'E401' && /one-time pass/.test(err.body))) {
        const otp = await read.otp('This operation requires a one-time password.\nEnter OTP:')
        return await fn({ ...opts, otp })
      }

      // Re-throw any other errors
      throw err
    }
  }
}

module.exports = RegistryClient
