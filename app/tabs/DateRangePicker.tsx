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
    return (<>
        <Button onPress={() => setRange(range.minusRange())} icon={"minus"}>-</Button>
        <Button onPress={() => setOpen(true)} uppercase={false} mode="outlined">
            {getDateStringFromDate(range.startDate) + " to " + getDateStringFromDate(range.endDate)}
        </Button>
        <Button onPress={() => setRange(range.plusOneRange())} icon={"plus"}>+</Button>
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

    public plusOneRange(): Range {
        return new Range(new Date(this.startDate.getDay() + this.getRange()),new Date( this.endDate.getDay() + this.getRange()));
    }

    private getRange(): number {
        return this.endDate.getDate() - this.startDate.getDate()
    }

    public minusRange(): Range {
        return new Range(new Date(this.startDate.getDay() - this.getRange()),new Date( this.endDate.getDay() - this.getRange()));
    }
}

export default DateRangePicker;
