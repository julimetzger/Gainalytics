import * as React from 'react';
import {Button} from 'react-native-paper';
import {DatePickerModal} from 'react-native-paper-dates';

interface DatePickerProps {
    date: Date,
    setDate: (arg: Date) => void
}

const DatePicker = ({date, setDate}: DatePickerProps) => {
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
        <>
            <Button onPress={() => setOpen(true)} uppercase={false} mode="outlined">
                {new Date(date).toDateString()}
            </Button>
            <DatePickerModal
                locale="en"
                mode="single"
                visible={open}
                onDismiss={onDismissSingle}
                date={date}
                onConfirm={onConfirmSingle}
            />
        </>
    );
}
export default DatePicker;
