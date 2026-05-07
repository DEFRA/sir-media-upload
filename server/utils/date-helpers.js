// returns date in this format -> 2.40 pm on Monday 30 April 2026
const returnFormattedDate = (dateTime = new Date()) => {
  const d = dateTime instanceof Date ? dateTime : new Date(dateTime)
  const time = d.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12'
  }).toLowerCase() // gives "2:48 pm"

  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const day = d.getDate()
  const month = d.toLocaleDateString('en-GB', { month: 'long' })
  const year = d.getFullYear()
  const date = `${time} on ${weekday}, ${day} ${month} ${year}`// gives 2.40 pm on Monday 30 April 2026

  return date
}

export {
  returnFormattedDate
}
