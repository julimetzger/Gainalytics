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
            setRange(new Range(startDate, endDate));
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

export class Range {
    constructor(startDate: Date, endDate: Date) {
        this.startDate = startDate;
        this.endDate = endDate;
    }

    startDate: Date
    endDate: Date

    public minusDays(days: number): void {
        this.startDate.setDate(this.startDate.getDay() - days);
    }
}

export default DateRangePicker;
