const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const isWin = process.platform === 'win32'

function findElectronExe() {
  const dist = path.join(__dirname, 'node_modules', 'electron', 'dist')
  const exe = path.join(dist, isWin ? 'electron.exe' : 'electron')
  if (fs.existsSync(exe)) return exe
  return require('electron')
}

let electronStarted = false

const vite = spawn(isWin ? 'npx.cmd' : 'npx', ['vite', '--host', '--port', '5173'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: false,
  cwd: __dirname,
  env: process.env,
})

vite.stdout.on('data', (data) => {
  const text = data.toString()
  process.stdout.write(text)
  checkAndStart(text)
})

vite.stderr.on('data', (data) => {
  const text = data.toString()
  process.stderr.write(text)
  checkAndStart(text)
})

function checkAndStart(text) {
  if (!electronStarted && (text.includes('ready in') || text.includes('Local:'))) {
    electronStarted = true
    setTimeout(startElectron, 1500)
  }
}

function startElectron() {
  const electronPath = findElectronExe()
  const mainPath = path.join(__dirname, 'dist-electron', 'main.js')

  const env = {
    ...process.env,
    VITE_DEV_SERVER_URL: 'http://localhost:5173/',
    NODE_ENV: 'development',
  }

  console.log('\n' + '='.repeat(50))
  console.log('🚀 启动 Electron 桌面窗口...')
  console.log('   ' + electronPath)
  console.log('   主进程: ' + mainPath)
  console.log('='.repeat(50) + '\n')

  const electron = spawn(electronPath, [mainPath], {
    stdio: 'inherit',
    env,
    cwd: __dirname,
    detached: false,
  })

  electron.on('close', (code) => {
    console.log(`\nElectron 窗口已关闭 (code ${code})`)
    vite.kill()
    process.exit(code ?? 0)
  })

  electron.on('error', (err) => {
    console.error('Electron 启动失败:', err.message)
    console.log('你可以使用 npm run dev:web 在浏览器中预览')
  })
}

vite.on('close', (code) => {
  process.exit(code ?? 0)
})

vite.on('error', (err) => {
  console.error('Vite 启动失败:', err.message)
})

setTimeout(() => {
  if (!electronStarted) {
    console.log('\n⚠️  等待 Vite 启动中... 如果长时间无响应请检查 5173 端口是否被占用')
  }
}, 8000)

setTimeout(() => {
  if (!electronStarted) {
    console.log('\n❌ Vite 启动超时，正在退出...')
    vite.kill()
    process.exit(1)
  }
}, 20000)
