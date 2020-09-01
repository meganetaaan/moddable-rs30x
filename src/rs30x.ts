import Serial from 'serial'

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
  for (const n of arr.slice(2)) {
    sum ^= n
  }
  return sum
}

class RS30X {
  #serial = new Serial()
  #buf = new ArrayBuffer(26)
  #view = new DataView(this.#buf)
  #id: number
  constructor({ id }: { id: number }) {
    this.#id = id
    this.#serial.setTimeout(300)
  }
  private _writeCommand(command: number[]) {
    const msg = [...COMMANDS.START, this.#id, ...command]
    msg.push(checksum(msg))
    trace(`writing: ${msg.map((m) => m.toString(16))}\n`)
    this.#serial.write(Uint8Array.from(msg).buffer)
  }
  private _readStatus(): Status {
    this._writeCommand(COMMANDS.REQUEST_STATUS)
    this.#serial.readBytes(this.#buf, 26)
    const angle = this.#view.getUint16(7, true) / 10
    const time = this.#view.getUint16(9, true) * 10
    const speed = this.#view.getUint16(11, true)
    const current = this.#view.getUint16(13, true)
    const temperature = this.#view.getUint16(15, true)
    const voltage = this.#view.getUint16(17, true) * 10
    return {
      angle,
      time,
      speed,
      current,
      temperature,
      voltage,
    }
  }
  setId(id: number): void {
    this._writeCommand([...COMMANDS.SET_SERVO_ID, id])
    this._writeCommand(COMMANDS.FLASH)
    this.#id = id
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
  readStatus(): Status {
    return this._readStatus()
  }
  reboot(): void {
    this._writeCommand(COMMANDS.REBOOT)
  }
}

export default RS30X
