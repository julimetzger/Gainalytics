package com.powerliftingworkoutplanner.healthconnect

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView

/**
 * GH-528: Health Connect opens this activity to show how Gainalytics uses health data
 * (Android 13: ACTION_SHOW_PERMISSIONS_RATIONALE, Android 14+: the VIEW_PERMISSION_USAGE alias).
 * It shows the bundled privacy policy, which has to match the one linked in the Play Store
 * (assets/privacy-policy.html is a copy of the repo's index.html; a Jest test keeps them equal).
 */
class HealthConnectRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val webView = WebView(this)
    webView.settings.javaScriptEnabled = false
    webView.settings.allowFileAccess = true
    webView.loadUrl(PRIVACY_POLICY_URL)
    setContentView(webView)
  }

  companion object {
    const val PRIVACY_POLICY_URL = "file:///android_asset/privacy-policy.html"
  }
}
