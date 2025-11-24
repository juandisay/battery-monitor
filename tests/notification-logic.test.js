/**
 * Validate notification loop behavior for interval edge cases.
 */
function shouldLoop(intervalSec) {
  const n = Number(intervalSec)
  if (!Number.isFinite(n) || n < 0) return false
  return n > 0
}

function clampInterval(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 60
  return Math.min(3600, Math.max(0, Math.round(x)))
}

/**
 * Simple assertions utility.
 */
function assert(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${name}`)
  }
}

/**
 * Run tests.
 */
function run() {
  assert('interval=0 => single notification', shouldLoop(0) === false)
  assert('interval>0 => loop notifications', shouldLoop(1) === true)
  assert('interval=3600 => loop allowed', shouldLoop(3600) === true)
  assert('interval<0 => invalid', shouldLoop(-1) === false)
  assert('interval=NaN => invalid', shouldLoop('abc') === false)

  assert('clampInterval lower bound', clampInterval(-5) === 0)
  assert('clampInterval upper bound', clampInterval(4000) === 3600)
  assert('clampInterval rounds', clampInterval(59.6) === 60)
}

run()
