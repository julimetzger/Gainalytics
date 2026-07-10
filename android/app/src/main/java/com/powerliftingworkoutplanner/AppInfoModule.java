package com.powerliftingworkoutplanner;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

import java.util.HashMap;
import java.util.Map;

public class AppInfoModule extends ReactContextBaseJavaModule {

    public AppInfoModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "AppInfo";
    }

    @Override
    public Map<String, Object> getConstants() {
        Map<String, Object> constants = new HashMap<>();
        constants.put("versionName", BuildConfig.VERSION_NAME);
        constants.put("versionCode", BuildConfig.VERSION_CODE);
        return constants;
    }
}
