declare function trace(msg: any): void
import Timer from 'timer'
import RS30X, { TorqeMode } from 'rs30x'

const servo = new RS30X({
  id: 1,
})

servo.setTorqueMode(TorqeMode.ON)

let flag = false
Timer.repeat(() => {
  const status = servo.readStatus()
  trace(
    `angle: ${status.angle}, time: ${status.time}, speed: ${status.speed}, current: ${status.current}, voltage: ${status.voltage}\n`
  )
}, 100)

Timer.repeat(() => {
  if (flag) {
    servo.setAngleInTime(120, 0.5)
  } else {
    servo.setAngleInTime(90, 1.5)
  }
  flag = !flag
}, 2000)
