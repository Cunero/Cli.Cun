const npa = require('npm-package-arg')
const { log } = require('proc-log')
const semver = require('semver')
const getIdentity = require('../utils/get-identity.js')
const libaccess = require('libnpmaccess')
const BaseCommand = require('../base-cmd.js')

class Deprecate extends BaseCommand {
  static description = 'Deprecate a version of a package'
  static name = 'deprecate'
  static usage = ['<package-spec> <message>']
  static params = [
    'registry',
    'otp',
    'dry-run',
  ]

  static ignoreImplicitWorkspace = true

  static async completion (opts, npm) {
    if (opts.conf.argv.remain.length > 1) {
      return []
    }

    const username = await getIdentity(npm, npm.flatOptions)
    const packages = await libaccess.getPackages(username, npm.flatOptions)
    return Object.keys(packages)
      .filter((name) =>
        packages[name] === 'write' &&
        (opts.conf.argv.remain.length === 0 ||
          name.startsWith(opts.conf.argv.remain[0])))
  }

  async exec ([pkg, msg]) {
    // msg == null because '' is a valid value, it indicates undeprecate
    if (!pkg || msg == null) {
      throw this.usageError()
    }

    // fetch the data and make sure it exists.
    const p = npa(pkg)
    const spec = p.rawSpec === '*' ? '*' : p.fetchSpec

    if (semver.validRange(spec, true) === null) {
      throw new Error(`invalid version range: ${spec}`)
    }

    const uri = '/' + p.escapedName
    const packument = await this.npm.registry.fetchJson(uri, {
      spec: p,
      query: { write: true },
    })

    const versions = Object.keys(packument.versions)
      .filter(v => semver.satisfies(v, spec, { includePrerelease: true }))

    const dryRun = this.npm.config.get('dry-run')

    if (versions.length) {
      for (const v of versions) {
        packument.versions[v].deprecated = msg
        if (msg) {
          log.notice(`deprecating ${packument.name}@${v} with message "${msg}"`)
        } else {
          log.notice(`undeprecating ${packument.name}@${v}`)
        }
      }
      if (!dryRun) {
        return this.npm.registry.fetch(uri, {
          spec: p,
          method: 'PUT',
          body: packument,
          ignoreBody: true,
        })
      }
    } else {
      log.warn('deprecate', 'No version found for', p.rawSpec)
    }
  }
}

module.exports = Deprecate
