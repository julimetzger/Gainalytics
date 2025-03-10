import * as React from 'react';
import {Button, Modal, Portal, useTheme} from 'react-native-paper';
import {DatePickerInput} from 'react-native-paper-dates';
import {StyleProp, View, ViewStyle, StyleSheet} from "react-native";
import {
    getDateStringFromDate,
    getEndOfMonth,
    getFirstDayOfMonth,
    getYYYYMMDDFormat,
    subtractMonths
} from "../utils/DateHelper";
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import {Range} from "./DateRangePicker";
import {useState} from "react";
import {CalendarList} from "react-native-calendars/src";

interface DatePickerProps {
    date: Date,
    setDate: (arg: Date) => void,
    style?: StyleProp<ViewStyle>
}

const DatePicker = ({date, setDate, style}: DatePickerProps) => {
    const [open, setOpen] = React.useState(false);
    let useTheme1 = useTheme();
    const [range, setRange] = useState(new Range(subtractMonths(4, getFirstDayOfMonth(date)), getEndOfMonth(date)))
    let workoutsDone = useWorkoutsIn(range);

    const onDismissSingle = React.useCallback(() => {
        setOpen(false);
    }, [setOpen]);
    let dates = workoutsDone.map((workout) => getYYYYMMDDFormat(workout.start!!));
    let utcDate = getYYYYMMDDFormat(date);
    const set = new Set(dates.filter((date) => date !== utcDate));

    let fromEntries = Object.fromEntries(Array.from(set).map((date) => {
        return [date, {marked: true}]
    }));
    return (
        <View style={style}>
            <Button onPress={() => setOpen(true)} uppercase={false} mode="outlined"
                    style={{display: 'flex', alignSelf: 'center'}}>
                {getDateStringFromDate(date)}
            </Button>
            <Portal>
                <Modal visible={open} onDismiss={onDismissSingle} contentContainerStyle={styles.modal}>
                    <View style={styles.modalContent}>
                        <View style={{flexDirection: 'row', display: 'flex', justifyContent: 'flex-start'}}>
                            <View style={{flex: 2}}>
                                <DatePickerInput
                                    locale="en"
                                    withModal={false}
                                    value={date}
                                    onChange={(d) => d ? setDate(d) : null}
                                    inputMode="start"
                                />
                            </View>
                            <View style={{flex: 1}}>
                                <Button mode='elevated' onPress={() => setOpen(false)}>Save</Button>
                            </View>
                        </View>
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
                            onDayPress={(dateData) => {
                                setDate(new Date(dateData.timestamp))
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
                        />
                    </View>
                </Modal>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    modal: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginTop: 64,
    },
    modalContent: {
        width: '100%',
        height: '100%',
    },
});

export default DatePicker;
