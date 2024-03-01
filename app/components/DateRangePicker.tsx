import {DatePickerModal} from "react-native-paper-dates";
import React, {useCallback, useRef, useState} from 'react';
import {Button, Icon} from "react-native-paper";
import {getDateStringFromDate} from "../utils/DateHelper";
import {View} from "react-native";
import {Swipeable} from "react-native-gesture-handler";

const DateRangePicker = ({range, setRange}: DateRangePickerProps
) => {
    const [open, setOpen] = useState(false);

    let swipeableRef = useRef(null);
    let close = () => {
        setTimeout(() => {
            swipeableRef?.current?.close();
        }, 250);
    };

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
            flexDirection: "row", justifyContent: "center"
        }}>
            <Swipeable ref={swipeableRef} onSwipeableOpen={(direction) => {
                if (direction === "left")
                    setRange(range.minusRange());
                if (direction === "right")
                    setRange(range.plusOneRange());
                close();
            }}
                       dragOffsetFromLeftEdge={2}
                       dragOffsetFromRightEdge={2}
                       renderLeftActions={() => {
                           return (<Icon size={50} source={"chevron-left"}/>)
                       }}
                       renderRightActions={() => {
                           return (<Icon size={50} source={"chevron-right"}/>)
                       }}
                       overshootRight={false}
                       overshootLeft={false}>
                <Button onPress={() => setOpen(true)} uppercase={false} mode="outlined"
                        style={{display: 'flex', alignSelf: 'center'}}>
                    {getDateStringFromDate(range.startDate) + " to " + getDateStringFromDate(range.endDate)}
                </Button>
            </Swipeable>
        </View>
        <DatePickerModal
            locale="en-GB"
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
        if (endDate === undefined) {
            this.endDate = new Date(Date.now());
        } else {
            this.endDate = endDate;
        }
    }

    startDate: Date
    endDate: Date

    public plusOneRange(): Range {
        let startDateNew = this.startDate.getTime() + this.getRange();
        let endDateNew = this.endDate.getTime() + this.getRange();
        return new Range(new Date(startDateNew), new Date(endDateNew));
    }

    private getRange(): number {
        return this.endDate.getTime() - this.startDate.getTime() + 1000
    }

    public minusRange(): Range {
        let startDateNew = this.startDate.getTime() - this.getRange();
        let endDateNew = this.endDate.getTime() - this.getRange();
        return new Range(new Date(startDateNew), new Date(endDateNew));
    }

    dateIsInRange(date: Date) {
        return new Date(date).getTime() > this.startDate.getTime() && new Date(date).getTime() < this.endDate.getTime();
    }
}

export default DateRangePicker;
