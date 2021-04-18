declare function trace(msg: any): void
import Timer from 'timer'
import RS30X, { Rotation, RS30XBatch, TorqeMode } from 'rs30x'

const pan = new RS30X({
  id: 1,
})
const tilt = new RS30X({
  id: 2,
})
// tilt.flashId(2)
pan.setTorqueMode(TorqeMode.ON)
tilt.setTorqueMode(TorqeMode.ON)
tilt.setComplianceSlope(Rotation.CW, 0x24)
tilt.setComplianceSlope(Rotation.CCW, 0x24)

const batch = new RS30XBatch([pan, tilt])

Timer.repeat(() => {
  const status = pan.readStatus()
  trace(
    `angle: ${status.angle}, time: ${status.time}, speed: ${status.speed}, current: ${status.current}, voltage: ${status.voltage}\n`
  )
}, 100)

// let flag = false
Timer.repeat(() => {
  batch.playMotion({
    duration: 2000,
    cuePoints: [0, 0.1, 0.2, 0.3, 0.5, 1.0],
    keyFrames: [
      [null, null, 20, null, null, 140],
      [null, 20, 40, 60, 80, 100],
    ],
  })
  /*
  if (flag) {
    pan.setAngleInTime(120, 0.5)
  } else {
    pan.setAngleInTime(90, 1.5)
  }
  flag = !flag
  */
}, 3000)
