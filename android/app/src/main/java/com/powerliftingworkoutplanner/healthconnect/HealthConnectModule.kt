package com.powerliftingworkoutplanner.healthconnect

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSegment
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * GH-528: Health Connect bridge (grown out of the GH-502 PoC).
 *
 * Every call checks availability itself and rejects instead of throwing, so JS can treat a
 * missing provider or revoked permissions as a normal, recoverable failure. Permissions are
 * never cached here: callers read the granted set before each use.
 */
class HealthConnectModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
  private var requestCounter = 0

  override fun getName(): String = NAME

  override fun invalidate() {
    scope.cancel()
    super.invalidate()
  }

  private fun client(): HealthConnectClient {
    check(HealthConnectClient.getSdkStatus(reactApplicationContext) == HealthConnectClient.SDK_AVAILABLE) {
      "Health Connect is not available"
    }
    return HealthConnectClient.getOrCreate(reactApplicationContext)
  }

  private fun launchAndResolve(promise: Promise, block: suspend () -> Any?) {
    scope.launch {
      try {
        promise.resolve(block())
      } catch (e: Exception) {
        promise.reject(errorCode(e), e.message ?: e.javaClass.simpleName, e)
      }
    }
  }

  @ReactMethod
  fun getSdkStatus(promise: Promise) {
    val status = HealthConnectClient.getSdkStatus(reactApplicationContext)
    promise.resolve(
        when (status) {
          HealthConnectClient.SDK_AVAILABLE -> "AVAILABLE"
          HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "PROVIDER_UPDATE_REQUIRED"
          else -> "UNAVAILABLE"
        })
  }

  /** Android 14+ ships Health Connect with the system; up to Android 13 it is a Play Store app. */
  @ReactMethod
  fun isProvidedBySystem(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
  }

  @ReactMethod
  fun getGrantedPermissions(promise: Promise) {
    launchAndResolve(promise) {
      Arguments.fromList(client().permissionController.getGrantedPermissions().sorted())
    }
  }

  /**
   * Opens the Health Connect permission dialog for [permissions] and resolves with the
   * permissions granted in this dialog only — callers must re-read the full granted set.
   */
  @ReactMethod
  fun requestPermissions(permissions: ReadableArray, promise: Promise) {
    val activity = reactApplicationContext.currentActivity as? ComponentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No foreground activity to show the permission dialog")
      return
    }
    val requested = (0 until permissions.size()).mapNotNull { permissions.getString(it) }.toSet()
    UiThreadUtil.runOnUiThread {
      var launcher: ActivityResultLauncher<Set<String>>? = null
      try {
        client()
        launcher =
            activity.activityResultRegistry.register(
                "gainalytics-health-connect-${requestCounter++}",
                PermissionController.createRequestPermissionResultContract()) { granted ->
                  launcher?.unregister()
                  promise.resolve(Arguments.fromList(granted.sorted()))
                }
        launcher.launch(requested)
      } catch (e: Exception) {
        launcher?.unregister()
        promise.reject(errorCode(e), e.message, e)
      }
    }
  }

  /**
   * Without READ_HEALTH_DATA_HISTORY an app reads only data from up to 30 days before its first
   * grant (on Android 13 even its own). The permission only exists on newer providers.
   */
  @ReactMethod
  fun isHistoryReadAvailable(promise: Promise) {
    try {
      promise.resolve(
          client().features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY) ==
              HealthConnectFeatures.FEATURE_STATUS_AVAILABLE)
    } catch (e: Exception) {
      promise.reject(errorCode(e), e.message, e)
    }
  }

  /** Reads all body weight records in [startMs, endMs), oldest first, following every page. */
  @ReactMethod
  fun readWeights(startMs: Double, endMs: Double, promise: Promise) {
    launchAndResolve(promise) {
      val result = Arguments.createArray()
      val labels = mutableMapOf<String, String>()
      var pageToken: String? = null
      do {
        val response =
            client()
                .readRecords(
                    ReadRecordsRequest(
                        recordType = WeightRecord::class,
                        timeRangeFilter =
                            TimeRangeFilter.between(
                                Instant.ofEpochMilli(startMs.toLong()),
                                Instant.ofEpochMilli(endMs.toLong())),
                        ascendingOrder = true,
                        pageSize = 1000,
                        pageToken = pageToken))
        response.records.forEach { record ->
          val origin = record.metadata.dataOrigin.packageName
          val map = Arguments.createMap()
          map.putDouble("kg", record.weight.inKilograms)
          map.putDouble("time", record.time.toEpochMilli().toDouble())
          map.putString("origin", origin)
          map.putString("originLabel", labels.getOrPut(origin) { appLabel(origin) })
          result.pushMap(map)
        }
        pageToken = response.pageToken
      } while (pageToken != null)
      result
    }
  }

  /**
   * Writes one finished training as a strength-training ExerciseSessionRecord. The
   * clientRecordId makes the write an upsert: writing the same training again (with a higher
   * clientRecordVersion) replaces the earlier record instead of duplicating it.
   */
  @ReactMethod
  fun writeStrengthSession(session: ReadableMap, promise: Promise) {
    launchAndResolve(promise) {
      val zone = ZoneId.systemDefault().rules
      val start = Instant.ofEpochMilli(session.getDouble("startMs").toLong())
      val end = Instant.ofEpochMilli(session.getDouble("endMs").toLong())
      val segmentsJs = session.getArray("segments")
      val segments =
          (0 until (segmentsJs?.size() ?: 0)).map { index ->
            val segment = segmentsJs!!.getMap(index)!!
            ExerciseSegment(
                startTime = Instant.ofEpochMilli(segment.getDouble("startMs").toLong()),
                endTime = Instant.ofEpochMilli(segment.getDouble("endMs").toLong()),
                segmentType = segmentTypeOf(segment.getString("segmentType")),
                repetitions = segment.getInt("repetitions"))
          }
      val record =
          ExerciseSessionRecord(
              startTime = start,
              startZoneOffset = zone.getOffset(start),
              endTime = end,
              endZoneOffset = zone.getOffset(end),
              metadata =
                  Metadata.manualEntry(
                      clientRecordId = session.getString("clientRecordId")!!,
                      clientRecordVersion = session.getDouble("clientRecordVersion").toLong()),
              exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
              title = session.getString("title"),
              notes = session.getString("notes"),
              segments = segments)
      Arguments.fromList(client().insertRecords(listOf(record)).recordIdsList)
    }
  }

  /** Deletes the session written for [clientRecordId]; deleting a missing record is a no-op. */
  @ReactMethod
  fun deleteStrengthSession(clientRecordId: String, promise: Promise) {
    launchAndResolve(promise) {
      client()
          .deleteRecords(
              ExerciseSessionRecord::class,
              recordIdsList = emptyList(),
              clientRecordIdsList = listOf(clientRecordId))
      true
    }
  }

  /** Opens Health Connect (Android 13: separate app, Android 14+: system settings). */
  @ReactMethod
  fun openHealthConnect(promise: Promise) {
    startActivity(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS), promise)
  }

  /** Opens the screen where the user manages (and revokes) Gainalytics' Health Connect access. */
  @ReactMethod
  fun openManagePermissions(promise: Promise) {
    val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          Intent(ACTION_MANAGE_HEALTH_PERMISSIONS)
              .putExtra(Intent.EXTRA_PACKAGE_NAME, reactApplicationContext.packageName)
        } else {
          HealthConnectClient.getHealthConnectManageDataIntent(reactApplicationContext)
        }
    startActivity(intent, promise)
  }

  private fun startActivity(intent: Intent, promise: Promise) {
    try {
      reactApplicationContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject(errorCode(e), e.message, e)
    }
  }

  private fun appLabel(packageName: String): String =
      try {
        val pm = reactApplicationContext.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
      } catch (e: PackageManager.NameNotFoundException) {
        packageName
      }

  companion object {
    const val NAME = "HealthConnect"

    /** Android 14+ intent action, see android.health.connect.HealthConnectManager. */
    private const val ACTION_MANAGE_HEALTH_PERMISSIONS =
        "android.health.connect.action.MANAGE_HEALTH_PERMISSIONS"

    private fun errorCode(e: Exception): String =
        when (e) {
          is SecurityException -> "E_PERMISSION"
          is IllegalStateException -> "E_UNAVAILABLE"
          else -> "E_HEALTH_CONNECT"
        }

    /** Maps the JS-side segment keys (see healthConnectMapping.ts) to Health Connect ints. */
    fun segmentTypeOf(key: String?): Int =
        when (key) {
          "SQUAT" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_SQUAT
          "BENCH_PRESS" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_BENCH_PRESS
          "DEADLIFT" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_DEADLIFT
          "BARBELL_SHOULDER_PRESS" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_BARBELL_SHOULDER_PRESS
          "SHOULDER_PRESS" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_SHOULDER_PRESS
          "LAT_PULL_DOWN" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LAT_PULL_DOWN
          "PULL_UP" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_PULL_UP
          "DUMBBELL_ROW" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_DUMBBELL_ROW
          "LEG_PRESS" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LEG_PRESS
          "LEG_CURL" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LEG_CURL
          "LEG_EXTENSION" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LEG_EXTENSION
          "LUNGE" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LUNGE
          "HIP_THRUST" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_HIP_THRUST
          "ARM_CURL" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_ARM_CURL
          "LATERAL_RAISE" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LATERAL_RAISE
          "BACK_EXTENSION" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_BACK_EXTENSION
          "CRUNCH" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_CRUNCH
          "PLANK" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_PLANK
          "LEG_RAISE" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LEG_RAISE
          "KETTLEBELL_SWING" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_KETTLEBELL_SWING
          "REST" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_REST
          else -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_WEIGHTLIFTING
        }
  }
}
