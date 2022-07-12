import {DatePickerModal} from "react-native-paper-dates";
import React, {useCallback, useState} from 'react';
import {Button} from "react-native-paper";
import {getDateStringFromDate} from "../utils/DateHelper";

const DateRangePicker = ({range, setRange}: DateRangePickerProps
) => {
    const [open, setOpen] = useState(false);

    const onDismiss = useCallback(() => {
        setOpen(false);
    }, [setOpen]);

    const onConfirm = useCallback(
        ({startDate, endDate}) => {
            setOpen(false);
            setRange({startDate, endDate});
        },
        [setOpen, setRange]
    );
    return (<><Button onPress={() => setOpen(true)} uppercase={false} mode="outlined">
        {getDateStringFromDate(range.startDate) + " to " + getDateStringFromDate(range.endDate)}
    </Button>
        <DatePickerModal
            locale="en"
            mode="range"
            visible={open}
            onDismiss={onDismiss}
            startDate={range.startDate}
            endDate={range.endDate}
            onConfirm={onConfirm}
        />
    </>)
        ;
}

interface DateRangePickerProps {
    range: Range
    setRange: (range: Range) => void;
}

export interface Range {
    startDate: Date
    endDate: Date
}

export default DateRangePicker;
