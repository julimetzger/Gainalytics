package com.powerliftingworkoutplanner;

import android.app.AlarmManager;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class ExactAlarmModule extends ReactContextBaseJavaModule {

    public ExactAlarmModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "ExactAlarm";
    }

    @ReactMethod
    public void canScheduleExactAlarms(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                promise.resolve(true);
                return;
            }

            AlarmManager am = (AlarmManager) getReactApplicationContext().getSystemService(AlarmManager.class);
            boolean canSchedule = am != null && am.canScheduleExactAlarms();
            promise.resolve(canSchedule);

        } catch (Exception e) {
            promise.reject("ERR_EXACT_ALARM_CHECK", e);
        }
    }

    @ReactMethod
    public void openExactAlarmSettings(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(intent);
            }
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERR_EXACT_ALARM_SETTINGS", e);
        }
    }
}
