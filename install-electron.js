const fs = require('fs')
const path = require('path')
const extract = require('extract-zip')
const { downloadArtifact } = require('@electron/get')
const pkg = require('./node_modules/electron/package.json')

;(async () => {
  console.log('Downloading electron', pkg.version, '...')
  const zipPath = await downloadArtifact({
    version: pkg.version,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch,
    mirrorOptions: { mirror: 'https://npmmirror.com/mirrors/electron/' },
  })
  console.log('Zip:', zipPath)

  const distDir = path.resolve(__dirname, 'node_modules/electron/dist')
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })

  console.log('Extracting to', distDir, '...')
  await extract(zipPath, { dir: distDir })

  const exe = process.platform === 'win32' ? 'electron.exe' : 'electron'
  fs.writeFileSync(path.resolve(__dirname, 'node_modules/electron/path.txt'), exe)
  console.log('path.txt written:', exe)
  console.log('✓ Electron binary installed successfully!')
})().catch(e => {
  console.error(e)
  process.exit(1)
})
