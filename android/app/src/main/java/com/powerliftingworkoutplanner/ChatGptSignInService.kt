package com.powerliftingworkoutplanner

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * GH-504 PoC: keeps the app process out of the cached-app freezer while the user signs in to
 * ChatGPT in the browser. Without it Android freezes the backgrounded app ~10 s after the browser
 * opens, so the loopback listener never reads the OAuth redirect and the browser spins forever.
 * Declared only in the debug manifest; started/stopped by [ChatGptLoopbackModule].
 */
class ChatGptSignInService : Service() {

  override fun onCreate() {
    super.onCreate()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel =
          NotificationChannel(CHANNEL_ID, "ChatGPT sign-in (dev)", NotificationManager.IMPORTANCE_MIN)
      getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val launchIntent =
        Intent(this, MainActivity::class.java).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val pendingIntent =
        PendingIntent.getActivity(
            this, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ChatGPT sign-in")
            .setContentText("Waiting for the browser…")
            .setSmallIcon(R.mipmap.icon_notification)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(pendingIntent)
            .build()
    startForeground(NOTIFICATION_ID, notification)
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    private const val CHANNEL_ID = "chatgpt_poc_sign_in"
    private const val NOTIFICATION_ID = 9504
  }
}
