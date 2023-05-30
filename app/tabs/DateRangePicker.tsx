import {DatePickerModal} from "react-native-paper-dates";
import React, {useCallback, useState} from 'react';
import {Button} from "react-native-paper";
import {getDateStringFromDate} from "../utils/DateHelper";
import {View} from "react-native";

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
        <View style={{
            flexDirection: "row",
            justifyContent: "space-between"
        }}>
            <Button compact={true} onPress={() => setRange(range.minusRange())} icon={"chevron-left"}/>
            <Button onPress={() => setOpen(true)} uppercase={false} mode="outlined">
                {getDateStringFromDate(range.startDate) + " to " + getDateStringFromDate(range.endDate)}
            </Button>
            <Button compact={true} onPress={() => setRange(range.plusOneRange())} icon={"chevron-right"}></Button>
        </View>
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
        let startDateNew = new Date(this.startDate);
        startDateNew.setDate(startDateNew.getDate()+this.getRange());
        let endDateNew = new Date(this.endDate);
        endDateNew.setDate(endDateNew.getDate()+this.getRange());
        return new Range(startDateNew, new Date(endDateNew));
    }

    private getRange(): number {
        return this.endDate.getDate() - this.startDate.getDate()
    }

    public minusRange(): Range {
        let startDateNew = new Date(this.startDate);
        startDateNew.setDate(startDateNew.getDate()-this.getRange());
        let endDateNew = new Date(this.endDate);
        endDateNew.setDate(endDateNew.getDate()-this.getRange());
        return new Range(startDateNew, new Date(endDateNew));
    }
}

export default DateRangePicker;
