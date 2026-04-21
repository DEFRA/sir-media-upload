import { returnFormattedDate } from '../date-helpers.js'

describe('returnFormattedDate', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('formats a provided dateTime', () => {
    const dateTime = new Date(2026, 3, 9, 12, 30)
    const result = returnFormattedDate(dateTime)

    expect(result).toBe('12:30 pm on Thursday, 9 April 2026')
  })

  it('formats the current dateTime when no dateTime is provided', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 3, 9, 12, 30))
    const result = returnFormattedDate()

    expect(result).toBe('12:30 pm on Thursday, 9 April 2026')
  })
})
