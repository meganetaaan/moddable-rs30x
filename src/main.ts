import Serial from 'serial'
import Timer from 'timer'

declare function trace(msg: string): void

// type aliases
type TORQUE_OFF = 0
type TORQUE_ON = 1
type TORQUE_BREAK = 2
type TorqueMode = TORQUE_OFF | TORQUE_ON | TORQUE_BREAK
const TorqeMode: { [key: string]: TorqueMode } = {
  OFF: 0,
  ON: 1,
  BREAK: 2,
}

// constants
const COMMANDS = Object.freeze({
  START: [0xfa, 0xaf],
  FLASH: [0x40, 0xff, 0x00, 0x00],
  SET_ANGLE: [0x00, 0x1e, 0x02, 0x01],
  SET_ANGLE_IN_TIME: [0x00, 0x1e, 0x04, 0x01],
  SET_TORQUE: [0x00, 0x24, 0x01, 0x01],
  SET_SERVO_ID: [0x00, 0x04, 0x01, 0x01],
  SET_MAX_TORQUE: [0x00, 0x23, 0x01, 0x01],
  REQUEST_STATUS: [0x09, 0x00, 0x00, 0x01],
  REBOOT: [0x20, 0xff, 0x00, 0x00],
})

// file local methods
function checksum(arr: number[]) {
  let sum = 0
  for (const n of arr) {
    trace(`  checksum: ${n}\n`)
    sum ^= n
  }
  return sum
}

class RS30X {
  #serial = new Serial()
  #id: number
  constructor({ id }: { id: number }) {
    this.#id = id
    this.#serial.setTimeout(300)
  }
  private _write(command: number[]) {
    const msg = [...COMMANDS.START, this.#id, ...command]
    msg.push(checksum(msg))
    trace(`writing: ${msg.map((m) => m.toString(16))}\n`)
    this.#serial.write(Uint8Array.from(msg).buffer)
  }
  private _read() {
    return this.#serial.readBytes(26)
  }
  private _readStatus() {
    this._write(COMMANDS.REQUEST_STATUS)
    return this._read()
  }
  set id(id: number) {
    this._write([...COMMANDS.SET_SERVO_ID, id])
    this._write(COMMANDS.FLASH)
    this.#id = id
  }
  set maxTorque(maxTorque: number) {
    this._write([...COMMANDS.SET_MAX_TORQUE, maxTorque])
    this._write(COMMANDS.FLASH)
  }
  set angle(angle: number) {
    const a = Math.max(-150, Math.min(150, angle)) * 10
    trace(`setting angle to ${a}\n`)
    this._write([...COMMANDS.SET_ANGLE, a & 0xff, (a & 0xff00) >> 8])
  }
  set torqueMode(mode: TorqueMode) {
    this._write([...COMMANDS.SET_TORQUE, mode])
  }

  public readAngle(): string {
    return this._readStatus()
  }
  // self.__requestStatus(servo_id)
  //     b = self.ser.read(26)[7:9]
  //     return struct.unpack("<h", b)[0] / 10.0
  setAngleInTime(angle: number, goalTime: number) {
    const a = Math.max(-150, Math.min(150, angle)) * 10
    const g = goalTime * 100
    this._write([...COMMANDS.SET_ANGLE_IN_TIME, a & 0xff, (a & 0xff00) >> 8, g & 0xff, (g & 0xff00) >> 8])
  }
  reboot() {
    this._write(COMMANDS.REBOOT)
  }
}
const servo = new RS30X({
  id: 1,
})

servo.torqueMode = TorqeMode.ON

let flag = false
Timer.repeat(() => {
  trace('tick\n')
  if (flag) {
    servo.angle = -90
  } else {
    servo.angle = 90
  }
  flag = !flag
}, 1000)
