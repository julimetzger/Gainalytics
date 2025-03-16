import {
    getDaysBetween,
    getEndOfMonth,
    getFirstDayOfMonth,
    getYYYYMMDDFormat,
    subtractMonths
} from "../utils/DateHelper";
import * as React from "react";
import {useState} from "react";
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import {useTheme} from "react-native-paper";
import {Range} from "./DateRangePicker";
import {DateData} from "react-native-calendars";
import {CalendarList} from "react-native-calendars/src";
import {MarkedDates} from "react-native-calendars/src/types";

type DateOrRange = Date | NullableRange;

interface DatePickerModalProps<T extends DateOrRange> {
    date: T,
    onChange: (arg: T) => void
}

interface NullableRange {
    startDate?: Date,
    endDate?: Date
}

export const DatePickerModal = <T extends DateOrRange, >({
                                                             date, onChange
                                                         }: DatePickerModalProps<T>
    ) => {
        let useTheme1 = useTheme();
        const [range, setRange] = useState(
            date instanceof NullableRange
                ? new Range(subtractMonths(4, getFirstDayOfMonth(date.startDate)), getEndOfMonth(date.endDate))
                : new Range(subtractMonths(4, getFirstDayOfMonth(date)), getEndOfMonth(date))
        );
        let highlightedDates: MarkedDates = {};
        let workoutsDone = useWorkoutsIn(range);
        let dates = workoutsDone.map((workout) => getYYYYMMDDFormat(workout.start!!));
        if (date instanceof Range) {
            let startDate = date.startDate ? getYYYYMMDDFormat(date.startDate) : undefined;
            let endDate = date.endDate ? getYYYYMMDDFormat(date.endDate) : undefined;

            startDate ? highlightedDates[startDate] = {color: useTheme1.colors.primary, startingDay: true} : 0;
            endDate ? highlightedDates[endDate] = {color: useTheme1.colors.primary, endingDay: true} : 0;
            if (startDate && endDate) {
                let daysBetween = getDaysBetween(date.startDate, date.endDate);
                let daysBetweenMarkedDates = Object.fromEntries(Array.from(daysBetween).map((date) => {
                    return [date, {color: useTheme1.colors.primaryContainer}]
                }));
                highlightedDates = {
                    ...highlightedDates, ...daysBetweenMarkedDates
                }
            }
        }
        if (date instanceof Date) {
            let utcDate = getYYYYMMDDFormat(date);
            highlightedDates = {
                ...highlightedDates,
                [utcDate]: {color: useTheme1.colors.primary}
            }
            const set = new Set(dates.filter((date) => date !== utcDate));
            let fromEntries = Object.fromEntries(Array.from(set).map((date) => {
                return [date, {marked: true}]
            }));
            highlightedDates = {
                ...highlightedDates, ...fromEntries1
            }
        }

        function extracted(dateData: DateData) {
            if (date instanceof NullableRange) {
                if (date.startDate && !date.endDate) {
                    onChange(new NullableRange(
                        new Date(dateData.dateString),
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
                markedDates={{
                    [utcDate]: {selected: true, selectedColor: useTheme1.colors.primary},
                    ...fromEntries
                }}
                enableSwipeMonths={true}
                onVisibleMonthsChange={months => setRange(
                    new Range(
                        subtractMonths(2, getFirstDayOfMonth(new Date(months[0].timestamp))),
                        subtractMonths(-2, getEndOfMonth(new Date(months[0].timestamp)))
                    )
                )}
            />);
    }
;

export default DatePickerModal;
