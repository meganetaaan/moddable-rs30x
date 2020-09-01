import Timer from 'timer'
import RS30X, { TorqeMode } from 'rs30x'

const servo = new RS30X({
  id: 1,
})

servo.setTorqueMode(TorqeMode.ON)

let flag = false
Timer.repeat(() => {
  if (flag) {
    servo.setAngleInTime(120, 0.5)
  } else {
    servo.setAngleInTime(90, 1.5)
  }
  flag = !flag
}, 2000)
