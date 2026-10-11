package com.powerliftingworkoutplanner.healthconnectpoc

import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSegment
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Mass
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * GH-502 proof of concept: Health Connect bridge.
 *
 * Lives in the debug source set only, so release builds contain neither this module, the
 * Health Connect client library nor the health permissions. JS reaches it through
 * `NativeModules.HealthConnectPoc` and must treat it as optional.
 */
class HealthConnectPocModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
  private var requestCounter = 0

  override fun getName(): String = NAME

  override fun invalidate() {
    scope.cancel()
    super.invalidate()
  }

  private fun client(): HealthConnectClient {
    // The client library needs API 26 while the app still supports 24 (manifest overrideLibrary).
    check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) { "Health Connect needs Android 8.0+" }
    return HealthConnectClient.getOrCreate(reactApplicationContext)
  }

  @ReactMethod
  fun getSdkStatus(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve("UNSUPPORTED_ANDROID_VERSION")
      return
    }
    val status = HealthConnectClient.getSdkStatus(reactApplicationContext)
    promise.resolve(
        when (status) {
          HealthConnectClient.SDK_AVAILABLE -> "AVAILABLE"
          HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "PROVIDER_UPDATE_REQUIRED"
          else -> "UNAVAILABLE"
        })
  }

  @ReactMethod
  fun getGrantedPermissions(promise: Promise) {
    scope.launch {
      try {
        val granted = client().permissionController.getGrantedPermissions()
        promise.resolve(Arguments.fromList(granted.sorted()))
      } catch (e: Exception) {
        promise.reject("E_HEALTH_CONNECT", e.message, e)
      }
    }
  }

  /** Opens the Health Connect permission dialog and resolves with the granted permissions. */
  @ReactMethod
  fun requestPermissions(promise: Promise) {
    val activity = reactApplicationContext.currentActivity as? ComponentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No foreground activity to show the permission dialog")
      return
    }
    UiThreadUtil.runOnUiThread {
      var launcher: ActivityResultLauncher<Set<String>>? = null
      launcher =
          activity.activityResultRegistry.register(
              "gainalytics-health-connect-poc-${requestCounter++}",
              PermissionController.createRequestPermissionResultContract()) { granted ->
                launcher?.unregister()
                promise.resolve(Arguments.fromList(granted.sorted()))
              }
      try {
        launcher.launch(PERMISSIONS)
      } catch (e: Exception) {
        launcher.unregister()
        promise.reject("E_HEALTH_CONNECT", e.message, e)
      }
    }
  }

  /** Reads the body weight records of the last [days] days, newest first. */
  @ReactMethod
  fun readWeights(days: Double, promise: Promise) {
    scope.launch {
      try {
        val response =
            client()
                .readRecords(
                    ReadRecordsRequest(
                        recordType = WeightRecord::class,
                        timeRangeFilter =
                            TimeRangeFilter.after(
                                Instant.now().minus(days.toLong(), ChronoUnit.DAYS)),
                        ascendingOrder = false,
                        pageSize = 20))
        val result = Arguments.createArray()
        response.records.forEach { record ->
          val map = Arguments.createMap()
          map.putDouble("kg", record.weight.inKilograms)
          map.putDouble("time", record.time.toEpochMilli().toDouble())
          map.putString("origin", record.metadata.dataOrigin.packageName)
          result.pushMap(map)
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("E_HEALTH_CONNECT", e.message, e)
      }
    }
  }

  /**
   * Writes one finished training as a strength-training ExerciseSessionRecord. The
   * clientRecordId makes the write idempotent: writing the same training again replaces the
   * earlier record instead of duplicating it.
   */
  @ReactMethod
  fun writeStrengthSession(session: ReadableMap, promise: Promise) {
    scope.launch {
      try {
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
        val response = client().insertRecords(listOf(record))
        promise.resolve(Arguments.fromList(response.recordIdsList))
      } catch (e: Exception) {
        promise.reject("E_HEALTH_CONNECT", e.message, e)
      }
    }
  }

  /**
   * Writes a body weight measurement. Only a stand-in data source for the PoC: on the Android 13
   * test device no external weight source (Samsung Health, Garmin, Withings) could be connected.
   */
  @ReactMethod
  fun writeTestWeight(kg: Double, promise: Promise) {
    scope.launch {
      try {
        val now = Instant.now()
        val record =
            WeightRecord(
                time = now,
                zoneOffset = ZoneId.systemDefault().rules.getOffset(now),
                weight = Mass.kilograms(kg),
                metadata = Metadata.manualEntry())
        val response = client().insertRecords(listOf(record))
        promise.resolve(Arguments.fromList(response.recordIdsList))
      } catch (e: Exception) {
        promise.reject("E_HEALTH_CONNECT", e.message, e)
      }
    }
  }

  /** Reads the exercise sessions of the last [days] days (all apps), newest first. */
  @ReactMethod
  fun readExerciseSessions(days: Double, promise: Promise) {
    scope.launch {
      try {
        val response =
            client()
                .readRecords(
                    ReadRecordsRequest(
                        recordType = ExerciseSessionRecord::class,
                        timeRangeFilter =
                            TimeRangeFilter.after(
                                Instant.now().minus(days.toLong(), ChronoUnit.DAYS)),
                        ascendingOrder = false,
                        pageSize = 20))
        val result = Arguments.createArray()
        response.records.forEach { record -> result.pushMap(sessionToMap(record)) }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("E_HEALTH_CONNECT", e.message, e)
      }
    }
  }

  /** Opens the Health Connect app (Android 13: separate app, Android 14+: system settings). */
  @ReactMethod
  fun openHealthConnect(promise: Promise) {
    try {
      val intent =
          android.content.Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).apply {
            addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
          }
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_HEALTH_CONNECT", e.message, e)
    }
  }

  private fun sessionToMap(record: ExerciseSessionRecord): WritableMap {
    val map = Arguments.createMap()
    map.putString("title", record.title)
    map.putInt("exerciseType", record.exerciseType)
    map.putDouble("startMs", record.startTime.toEpochMilli().toDouble())
    map.putDouble("endMs", record.endTime.toEpochMilli().toDouble())
    map.putString("origin", record.metadata.dataOrigin.packageName)
    map.putString("clientRecordId", record.metadata.clientRecordId)
    map.putInt("segmentCount", record.segments.size)
    map.putInt("repetitions", record.segments.sumOf { it.repetitions })
    return map
  }

  companion object {
    const val NAME = "HealthConnectPoc"

    val PERMISSIONS =
        setOf(
            HealthPermission.getReadPermission(WeightRecord::class),
            HealthPermission.getWritePermission(WeightRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        )

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
