package com.powerliftingworkoutplanner

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(AppInfoPackage())
              add(ExactAlarmPackage())
              add(VideoAnalysisPackage())
              add(ChatGptLoopbackPackage())
              add(FileSharePackage())
              debugOnlyPackage(HEALTH_CONNECT_POC_PACKAGE)?.let { add(it) }
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }

  companion object {
    // GH-502: the Health Connect PoC lives in src/debug, so release builds don't have the class.
    private const val HEALTH_CONNECT_POC_PACKAGE =
        "com.powerliftingworkoutplanner.healthconnectpoc.HealthConnectPocPackage"

    private fun debugOnlyPackage(className: String): ReactPackage? =
        if (!BuildConfig.DEBUG) null
        else
            try {
              Class.forName(className).getDeclaredConstructor().newInstance() as ReactPackage
            } catch (e: ReflectiveOperationException) {
              null
            }
  }
}
