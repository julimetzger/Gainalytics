package com.powerliftingworkoutplanner.healthconnect

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Mass
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * GH-528 debug-only test helper (emulators have no scale app that writes body weight).
 *
 * Extras:
 * - `weights`: "82.5@1,84@60" writes one WeightRecord per entry, kg at noon N days ago
 * - `clear`: deletes every weight and exercise session Gainalytics wrote (test cleanup)
 * - `dump`: logs Gainalytics' sessions and all weights under the tag [TAG]
 *
 * Writing weights needs the debug-only WRITE_WEIGHT permission; if it is missing the activity
 * asks for it with the regular Health Connect dialog.
 */
class HealthConnectTestDataActivity : ComponentActivity() {

  private val scope = MainScope()

  private val writeWeight = HealthPermission.getWritePermission(WeightRecord::class)

  override fun onDestroy() {
    scope.cancel()
    super.onDestroy()
  }

  private val permissionLauncher =
      registerForActivityResult(PermissionController.createRequestPermissionResultContract()) {
        run()
      }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    scope.launch {
      val granted = client().permissionController.getGrantedPermissions()
      if (intent.hasExtra(EXTRA_WEIGHTS) && writeWeight !in granted) {
        permissionLauncher.launch(setOf(writeWeight))
      } else {
        run()
      }
    }
  }

  private fun client() = HealthConnectClient.getOrCreate(this)

  private fun run() {
    scope.launch {
      try {
        if (intent.getBooleanExtra(EXTRA_CLEAR, false)) clear()
        intent.getStringExtra(EXTRA_WEIGHTS)?.let { writeWeights(it) }
        if (intent.getBooleanExtra(EXTRA_DUMP, false)) dump()
        Log.i(TAG, "done")
      } catch (e: Exception) {
        Log.e(TAG, "failed: ${e.message}", e)
      }
      finish()
    }
  }

  private suspend fun writeWeights(spec: String) {
    val zone = ZoneId.systemDefault()
    val records =
        spec.split(',').filter { it.isNotBlank() }.map { entry ->
          val (kg, daysAgo) = entry.split('@')
          val time =
              Instant.now().atZone(zone).toLocalDate().minusDays(daysAgo.trim().toLong())
                  .atTime(12, 0).atZone(zone).toInstant()
          WeightRecord(
              time = time,
              zoneOffset = zone.rules.getOffset(time),
              weight = Mass.kilograms(kg.trim().toDouble()),
              metadata = Metadata.manualEntry())
        }
    client().insertRecords(records)
    Log.i(TAG, "wrote ${records.size} weights")
  }

  private suspend fun clear() {
    val all = TimeRangeFilter.between(Instant.EPOCH, Instant.now().plus(1, ChronoUnit.DAYS))
    val own = packageName
    val weights = client().readRecords(ReadRecordsRequest(WeightRecord::class, all, pageSize = 5000))
    val weightIds = weights.records.filter { it.metadata.dataOrigin.packageName == own }.map { it.metadata.id }
    if (weightIds.isNotEmpty()) client().deleteRecords(WeightRecord::class, weightIds, emptyList())
    val sessions =
        client().readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, all, pageSize = 5000))
    val sessionIds = sessions.records.filter { it.metadata.dataOrigin.packageName == own }.map { it.metadata.id }
    if (sessionIds.isNotEmpty()) client().deleteRecords(ExerciseSessionRecord::class, sessionIds, emptyList())
    Log.i(TAG, "cleared ${weightIds.size} weights, ${sessionIds.size} sessions")
  }

  private suspend fun dump() {
    val all = TimeRangeFilter.between(Instant.EPOCH, Instant.now().plus(1, ChronoUnit.DAYS))
    client().readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, all, pageSize = 5000)).records
        .filter { it.metadata.dataOrigin.packageName == packageName }
        .forEach { s ->
          Log.i(
              TAG,
              "session clientRecordId=${s.metadata.clientRecordId} title=${s.title} " +
                  "start=${s.startTime} end=${s.endTime} type=${s.exerciseType} " +
                  "segments=${s.segments.joinToString(";") { "${it.segmentType}x${it.repetitions}" }}")
        }
    client().readRecords(ReadRecordsRequest(WeightRecord::class, all, pageSize = 5000)).records.forEach { w ->
      Log.i(TAG, "weight kg=${w.weight.inKilograms} time=${w.time} origin=${w.metadata.dataOrigin.packageName}")
    }
  }

  companion object {
    const val TAG = "GainalyticsHcTestData"
    const val EXTRA_WEIGHTS = "weights"
    const val EXTRA_CLEAR = "clear"
    const val EXTRA_DUMP = "dump"
  }
}
