package com.powerliftingworkoutplanner

import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.MediaStore
import android.widget.Toast
import java.io.File

/**
 * GH-496: the share sheet's "Save to Downloads" action. Copies the shared file from the
 * app cache into the public Downloads folder via MediaStore (no storage permission needed).
 */
class SaveToDownloadsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val path = intent.getStringExtra(EXTRA_PATH) ?: return
    val mimeType = intent.getStringExtra(EXTRA_MIME_TYPE) ?: "text/csv"
    val file = File(path)
    val message =
        try {
          if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) throw IllegalStateException("Android 10+ required")
          val values =
              ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, file.name)
                put(MediaStore.Downloads.MIME_TYPE, mimeType)
              }
          val resolver = context.contentResolver
          val uri =
              resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                  ?: throw IllegalStateException("Downloads not available")
          resolver.openOutputStream(uri).use { output -> file.inputStream().use { it.copyTo(output!!) } }
          "Saved to Downloads: ${file.name}"
        } catch (e: Exception) {
          "Could not save ${file.name}: ${e.message}"
        }
    Toast.makeText(context, message, Toast.LENGTH_LONG).show()
  }

  companion object {
    const val EXTRA_PATH = "com.powerliftingworkoutplanner.extra.PATH"
    const val EXTRA_MIME_TYPE = "com.powerliftingworkoutplanner.extra.MIME_TYPE"
  }
}
