export const firstDayOfWeek = (dateObject: Date, firstDayOfWeekIndex: number) => {

    const dayOfWeek = dateObject.getDay(),
        firstDayOfWeek = new Date(dateObject),
        diff = dayOfWeek >= firstDayOfWeekIndex ?
            dayOfWeek - firstDayOfWeekIndex :
            6 - dayOfWeek

    firstDayOfWeek.setDate(dateObject.getDate() - diff)
    firstDayOfWeek.setHours(0, 0, 0, 0)

    return firstDayOfWeek
}

export const getDateStringFromDate = (date?: Date | number) => {
    if (typeof date === 'number') {
        return new Date(date).toDateString();
    } else {
        return date?.toDateString();
    }
}
