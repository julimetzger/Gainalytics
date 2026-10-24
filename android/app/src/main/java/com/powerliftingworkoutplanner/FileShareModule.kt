package com.powerliftingworkoutplanner

import android.app.PendingIntent
import android.content.ClipData
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.service.chooser.ChooserAction
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * GH-496: opens the Android share sheet for a file the app wrote into `cache/exports/`
 * (the Strong CSV export). On Android 14+ the sheet also offers "Save to Downloads",
 * so the file can be kept on the device without any other app or account.
 */
class FileShareModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "FileShare"

  @ReactMethod
  fun shareFile(path: String, mimeType: String, title: String, promise: Promise) {
    try {
      val file = File(path)
      if (!file.isFile) {
        promise.reject("E_FILE_SHARE", "File not found: $path")
        return
      }
      val uri = FileProvider.getUriForFile(reactContext, authority(), file)
      val send =
          Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TITLE, file.name)
            putExtra(Intent.EXTRA_SUBJECT, file.name)
            clipData = ClipData.newRawUri(file.name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }
      val chooser = Intent.createChooser(send, title)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val save =
            Intent(reactContext, SaveToDownloadsReceiver::class.java).apply {
              putExtra(SaveToDownloadsReceiver.EXTRA_PATH, file.absolutePath)
              putExtra(SaveToDownloadsReceiver.EXTRA_MIME_TYPE, mimeType)
            }
        val pending =
            PendingIntent.getBroadcast(
                reactContext,
                file.absolutePath.hashCode(),
                save,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        val action =
            ChooserAction.Builder(
                    Icon.createWithResource(reactContext, android.R.drawable.stat_sys_download_done),
                    "Save to Downloads",
                    pending,
                )
                .build()
        chooser.putExtra(Intent.EXTRA_CHOOSER_CUSTOM_ACTIONS, arrayOf(action))
      }
      chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      val activity = reactContext.currentActivity
      if (activity != null) {
        activity.startActivity(chooser)
      } else {
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(chooser)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_FILE_SHARE", e.message, e)
    }
  }

  private fun authority() = "${reactContext.packageName}.fileshare"
}
