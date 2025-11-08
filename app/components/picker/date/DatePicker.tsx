import * as React from 'react';
import {Button, Modal, Portal} from 'react-native-paper';
import {DatePickerInput} from 'react-native-paper-dates';
import {StyleProp, View, ViewStyle, StyleSheet} from "react-native";
import {
    getDateStringFromDate,
} from "../../../utils/DateHelper";
import DatePickerModal from "./DatePickerModal";

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
                        <DatePickerModal
                            date={date}
                            onChange={setDate}/>
                    </View>
                </Modal>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    modal: {
        flex: 1,
        justifyContent:
            'flex-start',
        alignItems:
            'center',
        marginTop:
            64,
    }
    ,
    modalContent: {
        width: '100%',
        height:
            '100%',
    }
    ,
});

export default DatePicker;
