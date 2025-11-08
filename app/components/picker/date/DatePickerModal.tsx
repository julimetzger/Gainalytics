import {
    getDaysBetween,
    getEndOfMonth,
    getFirstDayOfMonth,
    getYYYYMMDDFormat,
    subtractMonths
} from "../../../utils/DateHelper";
import * as React from "react";
import {useState} from "react";
import {useWorkoutsIn} from "../../../redux/Workout/use/useWorkoutsIn";
import {useTheme} from "react-native-paper";
import {Range} from "./DateRangePicker";
import {DateData} from "react-native-calendars";
import {CalendarList} from "react-native-calendars/src";
import {MarkedDates} from "react-native-calendars/src/types";
import {NullableRange} from "./NullableRange";

type DateOrRange = Date | NullableRange;

interface DatePickerModalProps<T extends DateOrRange> {
    date: T,
    onChange: (arg: T) => void
}

export const DatePickerModal = <T extends DateOrRange, >({
                                                             date, onChange
                                                         }: DatePickerModalProps<T>
    ) => {
        let useTheme1 = useTheme();
        const [rangeForWorkouts, setRangeForWorkouts] = useState(
            date instanceof NullableRange
                ? new Range(subtractMonths(4, date.startDate ? getFirstDayOfMonth(date.startDate) : new Date()), getEndOfMonth(date.endDate ? date.endDate : new Date()))
                : new Range(subtractMonths(4, getFirstDayOfMonth(date)), getEndOfMonth(date))
        );
        let highlightedDates: MarkedDates = {};
        let workoutsDone = useWorkoutsIn(rangeForWorkouts);
        let dates = workoutsDone.map((workout) => getYYYYMMDDFormat(workout.start!!));
        if (date instanceof NullableRange) {
            let startDate = date.startDate ? getYYYYMMDDFormat(date.startDate) : undefined;
            let endDate = date.endDate ? getYYYYMMDDFormat(date.endDate) : undefined;
            let periodMarkings;

            startDate ? highlightedDates[startDate] = {
                color: useTheme1.colors.primary,
                startingDay: true
            } : 0;
            endDate ? highlightedDates[endDate] = {
                color: useTheme1.colors.primary,
                endingDay: true
            } : 0;
            if (startDate && endDate) {
                let daysBetween = getDaysBetween(date.startDate!!, date.endDate!!);
                periodMarkings = Array.from(daysBetween)
                    .map(date => getYYYYMMDDFormat(date))
                let daysBetweenMarkedDates = Object.fromEntries(periodMarkings
                    .filter(date => {
                        return date !== startDate && date !== endDate
                    })
                    .map((date) => {
                        return [date, {color: useTheme1.colors.primaryContainer}]
                    }));


                highlightedDates = {
                    ...highlightedDates, ...daysBetweenMarkedDates
                }
            }
            const set = new Set(dates);
            let fromEntries = Object.fromEntries(Array.from(set).map((date) => {
                if (startDate && startDate === date)
                    return [date, {
                        color: useTheme1.colors.primary,
                        startingDay: true,
                        marked: true,
                        dotColor: useTheme1.colors.onPrimary
                    }]
                if (endDate && endDate === date)
                    return [date, {
                        color: useTheme1.colors.primary,
                        endingDay: true,
                        dotColor: useTheme1.colors.onPrimary
                    }]
                if (periodMarkings!! && periodMarkings.includes(date))
                    return [date, {
                        color: useTheme1.colors.primaryContainer,
                        marked: true,
                        dotColor: useTheme1.colors.onPrimaryContainer
                    }]
                else {
                    return [date, {marked: true}]
                }
            }));
            highlightedDates = {...highlightedDates, ...fromEntries}
        }
        if (date instanceof Date) {
            let utcDate = getYYYYMMDDFormat(date);
            highlightedDates = {
                ...highlightedDates,
                [utcDate]: {selectedColor: useTheme1.colors.primary, selected: true}
            }
            const set = new Set(dates.filter((date) => date !== utcDate));
            let fromEntries = Object.fromEntries(Array.from(set).map((date) => {
                return [date, {marked: true}]
            }));
            highlightedDates = {
                ...highlightedDates, ...fromEntries
            }
        }

        function extracted(dateData: DateData) {
            if (date instanceof NullableRange) {
                if (date.startDate && !date.endDate) {
                    onChange(new NullableRange(
                        new Date(date.startDate),
                        new Date(dateData.dateString)
                    ) as T);
                }
                if (date.startDate && date.endDate) {
                    onChange(new NullableRange(
                        new Date(dateData.dateString),
                        undefined
                    ) as T);
                }
                if (!date.startDate && !date.endDate) {
                    onChange(new NullableRange(
                        new Date(dateData.dateString),
                        undefined
                    ) as T);
                }
                if (date.startDate && date.startDate > new Date(dateData.dateString)) {
                    onChange(new NullableRange(
                        new Date(dateData.dateString),
                        undefined
                    ) as T);
                }
            }
            if (date instanceof Date) {
                onChange(new Date(dateData.dateString) as T);
            }
        }

        return (
            <CalendarList
                markingType={"period"}
                theme={{
                    backgroundColor: useTheme1.colors.background,
                    calendarBackground: useTheme1.colors.background,
                    textSectionTitleColor: useTheme1.colors.onBackground,
                    selectedDayBackgroundColor: useTheme1.colors.primary,
                    selectedDayTextColor: useTheme1.colors.onPrimary,
                    todayTextColor: useTheme1.colors.primary,
                    dayTextColor: useTheme1.colors.onBackground,
                    textDisabledColor: useTheme1.colors.onBackground,
                    dotColor: useTheme1.colors.primary,
                    selectedDotColor: useTheme1.colors.onPrimary,
                    arrowColor: useTheme1.colors.primary,
                    monthTextColor: useTheme1.colors.primary,
                }}
                onDayPress={(dateData: DateData) => {
                    extracted(dateData);
                }}
                markedDates={highlightedDates}
                enableSwipeMonths={true}
                onVisibleMonthsChange={months => setRangeForWorkouts(
                    new Range(
                        subtractMonths(2, getFirstDayOfMonth(new Date(months[0].timestamp))),
                        subtractMonths(-2, getEndOfMonth(new Date(months[0].timestamp)))
                    )
                )}
            />);
    }
;

export default DatePickerModal;
