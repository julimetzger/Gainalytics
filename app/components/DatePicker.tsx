import * as React from 'react';
import {Button} from 'react-native-paper';
import {DatePickerModal} from 'react-native-paper-dates';
import {StyleProp, View, ViewStyle} from "react-native";
import {getDateStringFromDate} from "../utils/DateHelper";

interface DatePickerProps {
    date: Date,
    setDate: (arg: Date) => void,
    style?: StyleProp<ViewStyle>
}

const DatePicker = ({date, setDate, style}: DatePickerProps) => {
    const [open, setOpen] = React.useState(false);

    const onDismissSingle = React.useCallback(() => {
        setOpen(false);
    }, [setOpen]);

    const onConfirmSingle = React.useCallback(
        (params) => {
            setOpen(false);
            setDate(params.date);
        },
        [setOpen, setDate]
    );

    return (
        <View style={style}>
            <Button onPress={() => setOpen(true)} uppercase={false} mode="outlined"
                    style={{display: 'flex', alignSelf: 'center'}}>
                {getDateStringFromDate(date)}
            </Button>
            <DatePickerModal
                locale="en-GB"
                mode="single"
                visible={open}
                onDismiss={onDismissSingle}
                date={date}
                onConfirm={onConfirmSingle}
            />
        </View>
    );
}
export default DatePicker;
