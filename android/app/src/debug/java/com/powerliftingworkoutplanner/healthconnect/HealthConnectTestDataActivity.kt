package com.powerliftingworkoutplanner.healthconnect

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
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
 * - `sleep`: "7.5@1,6@2@staged" writes one night per entry, ending 07:00 N days ago (GH-619)
 * - `steps`: "20113@2" writes the steps between 10:00 and 11:00 N days ago (GH-619)
 * - `clear`: deletes every weight and exercise session Gainalytics wrote (test cleanup)
 * - `dump`: logs Gainalytics' sessions and all weights under the tag [TAG]
 *
 * Writing weights needs the debug-only WRITE_WEIGHT permission; if it is missing the activity
 * asks for it with the regular Health Connect dialog.
 */
class HealthConnectTestDataActivity : ComponentActivity() {

  private val scope = MainScope()

  private val writeWeight = HealthPermission.getWritePermission(WeightRecord::class)
  private val writeSleep = HealthPermission.getWritePermission(SleepSessionRecord::class)
  private val writeSteps = HealthPermission.getWritePermission(StepsRecord::class)

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
      val needed =
          listOfNotNull(
                  writeWeight.takeIf { intent.hasExtra(EXTRA_WEIGHTS) },
                  writeSleep.takeIf { intent.hasExtra(EXTRA_SLEEP) },
                  writeSteps.takeIf { intent.hasExtra(EXTRA_STEPS) })
              .filter { it !in granted }
              .toSet()
      if (needed.isNotEmpty()) {
        permissionLauncher.launch(needed)
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
        intent.getStringExtra(EXTRA_SLEEP)?.let { writeSleep(it) }
        intent.getStringExtra(EXTRA_STEPS)?.let { writeSteps(it) }
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

  private fun localTime(daysAgo: Long, hour: Int): Instant {
    val zone = ZoneId.systemDefault()
    return Instant.now().atZone(zone).toLocalDate().minusDays(daysAgo).atTime(hour, 0).atZone(zone).toInstant()
  }

  /**
   * GH-619: "7.5@1,6@2@staged" writes one night per entry that ends at 07:00 N days ago and lasted
   * the given hours; "staged" adds stages: first quarter DEEP, last quarter REM, LIGHT in between.
   */
  private suspend fun writeSleep(spec: String) {
    val zone = ZoneId.systemDefault().rules
    val records =
        spec.split(',').filter { it.isNotBlank() }.map { entry ->
          val parts = entry.split('@')
          val end = localTime(parts[1].trim().toLong(), 7)
          val start = end.minusSeconds((parts[0].trim().toDouble() * 3600).toLong())
          val quarter = (end.epochSecond - start.epochSecond) / 4
          val stages =
              if (parts.getOrNull(2)?.trim() == "staged")
                  listOf(
                      SleepSessionRecord.Stage(start, start.plusSeconds(quarter), SleepSessionRecord.STAGE_TYPE_DEEP),
                      SleepSessionRecord.Stage(start.plusSeconds(quarter), end.minusSeconds(quarter), SleepSessionRecord.STAGE_TYPE_LIGHT),
                      SleepSessionRecord.Stage(end.minusSeconds(quarter), end, SleepSessionRecord.STAGE_TYPE_REM))
              else emptyList()
          SleepSessionRecord(
              startTime = start,
              startZoneOffset = zone.getOffset(start),
              endTime = end,
              endZoneOffset = zone.getOffset(end),
              stages = stages,
              metadata = Metadata.manualEntry())
        }
    client().insertRecords(records)
    Log.i(TAG, "wrote ${records.size} sleep sessions")
  }

  /** GH-619: "20113@2" writes the steps as one record from 10:00 to 11:00 N days ago. */
  private suspend fun writeSteps(spec: String) {
    val zone = ZoneId.systemDefault().rules
    val records =
        spec.split(',').filter { it.isNotBlank() }.map { entry ->
          val (count, daysAgo) = entry.split('@')
          val start = localTime(daysAgo.trim().toLong(), 10)
          val end = start.plusSeconds(3600)
          StepsRecord(
              startTime = start,
              startZoneOffset = zone.getOffset(start),
              endTime = end,
              endZoneOffset = zone.getOffset(end),
              count = count.trim().toLong(),
              metadata = Metadata.manualEntry())
        }
    client().insertRecords(records)
    Log.i(TAG, "wrote ${records.size} steps records")
  }

  /**
   * Deletes by time range: Health Connect then removes only records this app wrote, including the
   * ones older than 30 days that reading (and so deleting by id) cannot reach without the history
   * permission.
   */
  private suspend fun clear() {
    val all = TimeRangeFilter.between(Instant.EPOCH, Instant.now().plus(1, ChronoUnit.DAYS))
    client().deleteRecords(WeightRecord::class, all)
    client().deleteRecords(ExerciseSessionRecord::class, all)
    client().deleteRecords(SleepSessionRecord::class, all)
    client().deleteRecords(StepsRecord::class, all)
    Log.i(TAG, "cleared all weights, sessions, sleep and steps written by ${packageName}")
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
    const val EXTRA_SLEEP = "sleep"
    const val EXTRA_STEPS = "steps"
    const val EXTRA_CLEAR = "clear"
    const val EXTRA_DUMP = "dump"
  }
}
