export const firstDayOfWeek = (dateObject: Date, firstDayOfWeekIndex: number) => {

    dateObject = new Date(dateObject);
    const dayOfWeek = dateObject.getDay(),
        firstDayOfWeek = dateObject,
        diff = dayOfWeek >= firstDayOfWeekIndex ?
            dayOfWeek - firstDayOfWeekIndex :
            6 - dayOfWeek

    firstDayOfWeek.setDate(dateObject.getDate() - diff)
    firstDayOfWeek.setHours(0, 0, 0, 0)

    return firstDayOfWeek
}

export const lastDayOfWeek = (dateObject: Date, lastDayOfWeekIndex: number) => {
    dateObject = new Date(dateObject);
    const dayOfWeek = dateObject.getDay(),
        firstDayOfWeek = dateObject,
        diff = dayOfWeek >= lastDayOfWeekIndex ?
            dayOfWeek - lastDayOfWeekIndex :
            6 - dayOfWeek

    firstDayOfWeek.setDate(dateObject.getDate() - diff + 7)
    firstDayOfWeek.setHours(23, 59, 59, 0)

    return firstDayOfWeek
}

export const getEndOfDay = (d: Date = new Date()) => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
}

export const getDateStringFromDate = (date?: Date | number) => {
    if (typeof date === 'number') {
        return new Date(date).toLocaleDateString('en-GB', {
            weekday: 'short', // Sat
            day: '2-digit',   // 02
            month: '2-digit', // 03
            year: '2-digit'   // 24
        });
    }
    if (typeof date === 'string') {
        return new Date(date).toLocaleDateString('en-GB',{
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    } else {
        return date?.toLocaleDateString('en-GB',{
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    }
}

export function dateComparator(a: Date, b: Date): number {
    const dateA = new Date(a).getTime();
    const dateB = new Date(b).getTime();

    if (dateA < dateB) {
        return -1;
    } else if (dateA > dateB) {
        return 1;
    } else {
        return 0;
    }
}

export function subtractMonths(numOfMonths: number, date = new Date()) {
    //TODO change! this does not work for january or when month < numOfMonths
    date.setMonth(date.getMonth() - numOfMonths);

    return date;
}

export function sameDate(a: Date, b: Date) {
    a = new Date(a);
    b = new Date(b);
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}
