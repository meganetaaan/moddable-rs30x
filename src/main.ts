declare function trace(msg: any): void
import Timer from 'timer'
import RS30X, { TorqeMode } from 'rs30x'

const pan = new RS30X({
  id: 1,
})
const tilt = new RS30X({
  id: 2,
})
// tilt.flashId(2)
pan.setTorqueMode(TorqeMode.ON)
tilt.setTorqueMode(TorqeMode.ON)

Timer.repeat(() => {
  const status = pan.readStatus()
  trace(
    `angle: ${status.angle}, time: ${status.time}, speed: ${status.speed}, current: ${status.current}, voltage: ${status.voltage}\n`
  )
}, 100)

let flag = false
Timer.repeat(() => {
  if (flag) {
    pan.setAngleInTime(120, 0.5)
  } else {
    pan.setAngleInTime(90, 1.5)
  }
  flag = !flag
}, 2000)

let flag2 = false
Timer.repeat(() => {
  if (flag2) {
    tilt.setAngleInTime(180, 1.0)
  } else {
    tilt.setAngleInTime(90, 0.3)
  }
  flag2 = !flag2
}, 1500)
