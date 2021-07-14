import Serial from 'serial'
import Timer from 'timer'

declare function trace(msg: string): void

// type aliases
type Status = {
  angle: number
  time: number
  speed: number
  current: number
  temperature: number
  voltage: number
}
type TORQUE_OFF = 0
type TORQUE_ON = 1
type TORQUE_BREAK = 2
type TorqueMode = TORQUE_OFF | TORQUE_ON | TORQUE_BREAK
export const TorqeMode: { [key: string]: TorqueMode } = Object.freeze({
  OFF: 0,
  ON: 1,
  BREAK: 2,
})
export const Rotation = Object.freeze({
  CW: 0,
  CCW: 1,
})
export type Rotation = typeof Rotation[keyof typeof Rotation]

// constants
const COMMANDS = Object.freeze({
  START: Object.freeze([0xfa, 0xaf]),
  FLASH: Object.freeze([0x40, 0xff, 0x00, 0x00]),
  SET_ANGLE: Object.freeze([0x00, 0x1e, 0x02, 0x01]),
  SET_ANGLE_IN_TIME: Object.freeze([0x00, 0x1e, 0x04, 0x01]),
  SET_MAX_ANGLE: [],
  SET_TORQUE: Object.freeze([0x00, 0x24, 0x01, 0x01]),
  SET_SERVO_ID: Object.freeze([0x00, 0x04, 0x01, 0x01]),
  SET_MAX_TORQUE: Object.freeze([0x00, 0x23, 0x01, 0x01]),
  SET_COMPLIANCE_SLOPE_CW: Object.freeze([0x00, 0x1a, 0x01, 0x01]),
  SET_COMPLIANCE_SLOPE_CCW: Object.freeze([0x00, 0x1b, 0x01, 0x01]),
  SET_DELAY: Object.freeze([0x00, 0x07, 0x01, 0x01]),
  REQUEST_STATUS: Object.freeze([0x09, 0x00, 0x00, 0x01]),
  REBOOT: Object.freeze([0x20, 0xff, 0x00, 0x00]),
  SET_ANGLES: Object.freeze([0x00, 0x1e, 0x03]),
  SET_ANGLES_IN_TIME: Object.freeze([0x00, 0x1e, 0x05]),
})

// file local methods
function checksum(arr: number[]) {
  let sum = 0
  for (const n of arr.slice(2)) {
    sum ^= n
  }
  return sum
}

interface RS30XConstructorParam {
  id: number
  serial?: Serial
}

let staticSerial: Serial
class RS30X {
  _serial: Serial
  _buf = new ArrayBuffer(64)
  _view = new DataView(this._buf)
  _id: number
  constructor({ id }: RS30XConstructorParam) {
    if (staticSerial == null) {
      staticSerial = new Serial()
    }
    this._id = id
    this._serial = staticSerial
    this._serial.setTimeout(5)
  }
  private _writeCommand(command: readonly number[]) {
    const msg = [...COMMANDS.START, this._id, ...command]
    msg.push(checksum(msg))
    this._serial.write(Uint8Array.from(msg).buffer)
    this._serial.readBytes(this._buf, msg.length)
  }
  private _readStatus(): Status {
    this._writeCommand(COMMANDS.REQUEST_STATUS)
    this._serial.readBytes(this._buf, 26)
    const angle = this._view.getInt16(7, true) / 10
    const time = this._view.getUint16(9, true) * 10
    const speed = this._view.getInt16(11, true)
    const current = this._view.getUint16(13, true)
    const temperature = this._view.getUint16(15, true)
    const voltage = this._view.getInt16(17, true) * 10
    return {
      angle,
      time,
      speed,
      current,
      temperature,
      voltage,
    }
  }
  flashId(id: number): void {
    this._writeCommand([...COMMANDS.SET_SERVO_ID, id])
    this._id = id
    this._writeCommand(COMMANDS.FLASH)
  }
  set id(_: number) {
    throw new Error('cannot set id of single servo. Use "flashId" function')
  }
  get id(): number {
    return this._id
  }
  setMaxTorque(maxTorque: number): void {
    this._writeCommand([...COMMANDS.SET_MAX_TORQUE, maxTorque])
    this._writeCommand(COMMANDS.FLASH)
  }
  setAngle(angle: number): void {
    const a = Math.max(-150, Math.min(150, angle)) * 10
    trace(`setting angle to ${a}\n`)
    this._writeCommand([...COMMANDS.SET_ANGLE, a & 0xff, (a & 0xff00) >> 8])
  }
  setTorqueMode(mode: TorqueMode): void {
    this._writeCommand([...COMMANDS.SET_TORQUE, mode])
  }
  setAngleInTime(angle: number, goalTime: number): void {
    const a = Math.max(-150, Math.min(150, angle)) * 10
    const g = goalTime * 100
    this._writeCommand([...COMMANDS.SET_ANGLE_IN_TIME, a & 0xff, (a & 0xff00) >> 8, g & 0xff, (g & 0xff00) >> 8])
  }
  setComplianceSlope(rotation: Rotation, angle: number): void {
    const command = rotation == Rotation.CW ? COMMANDS.SET_COMPLIANCE_SLOPE_CW : COMMANDS.SET_COMPLIANCE_SLOPE_CCW
    this._writeCommand([...command, angle])
  }
  readStatus(): Status {
    return this._readStatus()
  }
  reboot(): void {
    this._writeCommand(COMMANDS.REBOOT)
  }
}

interface Motion {
  duration?: number
  cuePoints?: number[]
  keyFrames: (number | null)[][]
}
export class RS30XBatch {
  _servos: RS30X[]
  _length: number
  _serial: Serial
  _buf: ArrayBuffer
  _ids: number[]
  constructor(servos: RS30X[]) {
    if (staticSerial == null) {
      staticSerial = new Serial()
    }
    this._serial = staticSerial
    this._servos = servos.slice()
    this._length = servos.length
    this._buf = new ArrayBuffer(5 + this._length * 5)
    this._ids = servos.map((s) => s.id)
  }
  playMotion(target: Motion): void {
    const { duration = 1000, cuePoints = [0, 1] } = target
    const keyFrames = target.keyFrames
    const numFrames = cuePoints.length
    const last = new Array(this._length).fill(0)
    const idx = new Array(this._length).fill(0)
    let current = 0
    for (let i = 0; i < numFrames; i++) {
      const values = []
      const time = (cuePoints[i] ?? 1) * duration
      if (time == null) {
        continue
      }
      for (let j = 0; j < this._length; j++) {
        let t = time
        const id = this._ids[j]
        let angle
        let k = idx[j]
        if (k > i) {
          continue
        }
        while (k < numFrames) {
          angle = keyFrames[j][k]
          if (angle != null) {
            t = (cuePoints[k] ?? 1) * duration - last[j]
            idx[j] = k + 1
            break
          }
          k++
        }
        if (angle == null) {
          continue
        }
        const a = Math.max(-180, Math.min(180, angle)) * 10
        const g = t / 10
        last[j] = t
        values.push(id)
        values.push(a & 0xff)
        values.push((a & 0xff00) >> 8)
        values.push(g & 0xff)
        values.push((g & 0xff00) >> 8)
      }
      const numCommands = values.length / 5
      if (numCommands > 0) {
        const command = [...COMMANDS.START, 0x00, ...COMMANDS.SET_ANGLES_IN_TIME, numCommands, ...values]
        command.push(checksum(command))
        trace(JSON.stringify(command) + '\n')
        this._serial.write(Uint8Array.from(command).buffer)
        this._serial.readBytes(this._buf, command.length)
      }
      Timer.delay(time - current)
      current = time
    }
  }
}

export default RS30X
