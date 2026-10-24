package com.powerliftingworkoutplanner.healthconnectpoc

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

/**
 * GH-502 PoC: Health Connect requires an activity that explains how the app uses health data
 * (Android 13: ACTION_SHOW_PERMISSIONS_RATIONALE, Android 14+: VIEW_PERMISSION_USAGE alias).
 * Without it the permission dialog refuses to show the app. A real feature would show the
 * privacy policy here.
 */
class HealthConnectRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val padding = (24 * resources.displayMetrics.density).toInt()
    setContentView(
        TextView(this).apply {
          setPadding(padding, padding, padding, padding)
          textSize = 16f
          text =
              "Gainalytics (Proof of Concept)\n\n" +
                  "Gainalytics liest dein Körpergewicht aus Health Connect, um relative Kraftwerte " +
                  "anzuzeigen, und schreibt beendete Trainings als Krafttraining-Einheiten nach " +
                  "Health Connect. Die Daten bleiben auf deinem Gerät; Gainalytics hat keinen Server."
        })
  }
}
