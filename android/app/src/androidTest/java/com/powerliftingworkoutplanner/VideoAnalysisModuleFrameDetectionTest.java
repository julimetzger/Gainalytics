package com.powerliftingworkoutplanner;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.util.Log;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.facebook.react.bridge.ReactApplicationContext;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@RunWith(AndroidJUnit4.class)
public class VideoAnalysisModuleFrameDetectionTest {
    private static final String LOG_TAG = "HoughDebugTest";
    private static final int MAX_TOP_CANDIDATES = 3;

    @Test
    public void initialHintlessTop3ContainsExpectedCandidate_forVideo1T0() throws Exception {
        FrameExpectation expectation = FrameExpectation.hintless("hough-frames/video1_t0.jpg", 630.0, 540.0, 160.0, 70.0);
        assertExpectedCandidate(expectation, false, true);
    }

    @Test
    public void initialHintedTopCandidateMatchesExpectedCandidate_forVideo1T0() throws Exception {
        FrameExpectation expectation = FrameExpectation.hinted("hough-frames/video1_t0.jpg", 630.0, 500.0, 160.0, 630.0, 540.0, 160.0, 70.0);
        assertExpectedCandidate(expectation, true, false);
    }

    @Test
    public void initialHintlessTop3ContainsExpectedCandidate_forVideo2T0() throws Exception {
        FrameExpectation expectation = FrameExpectation.hintless("hough-frames/video2_t0.jpg", 299.0, 322.0, 180.0, 72.0);
        assertExpectedCandidate(expectation, false, true);
    }

    @Test
    public void initialHintedTopCandidateMatchesExpectedCandidate_forVideo2T0() throws Exception {
        FrameExpectation expectation = FrameExpectation.hinted("hough-frames/video2_t0.jpg", 280.0, 350.0, 180.0, 290.0, 322.0, 180.0, 72.0);
        assertExpectedCandidate(expectation, true, false);
    }

    private void assertExpectedCandidate(FrameExpectation expectation, boolean useHint, boolean allowTopThree) throws Exception {
        VideoAnalysisModule module = createModule();
        Bitmap frame = loadAssetBitmap(expectation.assetPath);
        assertNotNull("Fixture bitmap must be readable", frame);

        VideoAnalysisModule.FrameHoughDebugResult result =
            module.detectPlateFromBitmapForTest(
                frame,
                useHint ? expectation.hintX : Double.NaN,
                useHint ? expectation.hintY : Double.NaN,
                useHint ? expectation.hintRadius : Double.NaN
            );
        List<VideoAnalysisModule.FrameHoughDebugCircle> sourceCandidates =
            !result.rankedHoughCandidates.isEmpty() ? result.rankedHoughCandidates : result.initialCircles;
        saveDebugOverlay(frame, expectation, result, sourceCandidates, useHint ? "hinted" : "hintless");
        String fallbackDebug = "";
        if (useHint && sourceCandidates.isEmpty()) {
            VideoAnalysisModule.FrameHoughDebugResult fallbackResult =
                module.detectPlateFromBitmapForTest(frame, Double.NaN, Double.NaN, Double.NaN);
            List<VideoAnalysisModule.FrameHoughDebugCircle> fallbackCandidates =
                !fallbackResult.rankedHoughCandidates.isEmpty() ? fallbackResult.rankedHoughCandidates : fallbackResult.initialCircles;
            saveDebugOverlay(frame, expectation, fallbackResult, fallbackCandidates, "hintless-fallback");
            fallbackDebug =
                ", fallback(hintless ranked=" + fallbackResult.rankedHoughCandidates.size() +
                    ", initial=" + fallbackResult.initialCircles.size() +
                    ", raw=" + fallbackResult.houghCandidates.size() +
                    ", top=" + describeTopCandidates(fallbackCandidates, expectation) + ")";
        }
        assertTrue(
            "Expected at least one scored Hough candidate (ranked=" + result.rankedHoughCandidates.size() + ", initial=" + result.initialCircles.size() + ", raw=" + result.houghCandidates.size() + fallbackDebug + ")",
            !sourceCandidates.isEmpty()
        );

        int topCount = allowTopThree ? Math.min(MAX_TOP_CANDIDATES, sourceCandidates.size()) : 1;
        boolean hasExpectedCircle = false;
        List<String> topThree = new ArrayList<>();
        for (int index = 0; index < topCount; index++) {
            VideoAnalysisModule.FrameHoughDebugCircle circle = sourceCandidates.get(index);
            double distance = Math.hypot(circle.x - expectation.expectedX, circle.y - expectation.expectedY);
            topThree.add(
                "idx=" + index +
                    " x=" + round(circle.x) +
                    " y=" + round(circle.y) +
                    " r=" + round(circle.radius) +
                    " score=" + round(circle.score) +
                    " dist=" + round(distance)
            );
            if (distance <= expectation.maxDistancePx) {
                hasExpectedCircle = true;
            }
        }

        assertTrue(
            (allowTopThree ? "Expected top-3 to contain expected candidate for " : "Expected top candidate to match expectation for ")
                + expectation.assetPath + " but got " + topThree,
            hasExpectedCircle
        );
    }

    private VideoAnalysisModule createModule() {
        ReactApplicationContext reactContext = new ReactApplicationContext(ApplicationProvider.getApplicationContext());
        return new VideoAnalysisModule(reactContext);
    }

    private Bitmap loadAssetBitmap(String assetPath) throws Exception {
        try (InputStream inputStream = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open(assetPath)) {
            return BitmapFactory.decodeStream(inputStream);
        }
    }

    private double round(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private void saveDebugOverlay(
        Bitmap sourceFrame,
        FrameExpectation expectation,
        VideoAnalysisModule.FrameHoughDebugResult result,
        List<VideoAnalysisModule.FrameHoughDebugCircle> topCandidates,
        String modeLabel
    ) throws Exception {
        Bitmap overlay = sourceFrame.copy(Bitmap.Config.ARGB_8888, true);
        Canvas canvas = new Canvas(overlay);
        Paint textPaint = buildPaint(Color.WHITE, Paint.Style.FILL, 32.0f, 0.0f);
        Paint textBackgroundPaint = buildPaint(Color.argb(180, 0, 0, 0), Paint.Style.FILL, 0.0f, 0.0f);
        Paint expectedPaint = buildPaint(Color.YELLOW, Paint.Style.STROKE, 0.0f, 6.0f);
        Paint rawPaint = buildPaint(Color.argb(170, 64, 196, 255), Paint.Style.STROKE, 0.0f, 3.0f);
        Paint topPaint = buildPaint(Color.argb(220, 88, 240, 120), Paint.Style.STROKE, 0.0f, 7.0f);
        Paint detectionPaint = buildPaint(Color.argb(220, 255, 106, 106), Paint.Style.STROKE, 0.0f, 7.0f);
        Paint centerPaint = buildPaint(Color.WHITE, Paint.Style.FILL, 0.0f, 0.0f);

        drawCircle(canvas, expectation.expectedX, expectation.expectedY, expectation.expectedRadius, expectedPaint, centerPaint);
        for (VideoAnalysisModule.FrameHoughDebugCircle circle : result.houghCandidates) {
            drawCircle(canvas, circle.x, circle.y, circle.radius, rawPaint, null);
        }
        int topCount = Math.min(MAX_TOP_CANDIDATES, topCandidates.size());
        for (int index = 0; index < topCount; index++) {
            VideoAnalysisModule.FrameHoughDebugCircle circle = topCandidates.get(index);
            drawCircle(canvas, circle.x, circle.y, circle.radius, topPaint, centerPaint);
            String label =
                "#" + (index + 1) +
                    " conf=" + round(circle.score) +
                    " x=" + round(circle.x) +
                    " y=" + round(circle.y) +
                    " r=" + round(circle.radius);
            drawLabel(canvas, label, (float) circle.x + 16.0f, (float) circle.y - 16.0f + (index * 36.0f), textPaint, textBackgroundPaint);
        }
        if (result.found) {
            drawCircle(canvas, result.x, result.y, result.radius, detectionPaint, centerPaint);
            drawLabel(
                canvas,
                "best conf=" + round(result.score) + " x=" + round(result.x) + " y=" + round(result.y) + " r=" + round(result.radius),
                20.0f,
                sourceFrame.getHeight() - 54.0f,
                textPaint,
                textBackgroundPaint
            );
        }

        drawLabel(
            canvas,
            modeLabel +
                " raw=" + result.houghCandidates.size() +
                " ranked=" + result.rankedHoughCandidates.size() +
                " initial=" + result.initialCircles.size(),
            20.0f,
            44.0f,
            textPaint,
            textBackgroundPaint
        );
        drawLabel(
            canvas,
            "hint x=" + round(expectation.hintX) + " y=" + round(expectation.hintY) + " r=" + round(expectation.hintRadius),
            20.0f,
            84.0f,
            textPaint,
            textBackgroundPaint
        );
        drawLabel(
            canvas,
            "expected x=" + round(expectation.expectedX) + " y=" + round(expectation.expectedY) + " r=" + round(expectation.expectedRadius),
            20.0f,
            124.0f,
            textPaint,
            textBackgroundPaint
        );

        File outputDir = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getFilesDir(), "hough-debug-tests");
        if (!outputDir.exists() && !outputDir.mkdirs()) {
            throw new IllegalStateException("Failed to create output dir: " + outputDir.getAbsolutePath());
        }
        String suffix = "-" + modeLabel + "-overlay.png";
        File outputFile = new File(outputDir, expectation.assetName() + suffix);
        try (FileOutputStream outputStream = new FileOutputStream(outputFile)) {
            if (!overlay.compress(Bitmap.CompressFormat.PNG, 100, outputStream)) {
                throw new IllegalStateException("Failed to write overlay: " + outputFile.getAbsolutePath());
            }
        } finally {
            overlay.recycle();
        }
        Log.i(LOG_TAG, "Saved hough overlay: " + outputFile.getAbsolutePath());
    }

    private Paint buildPaint(int color, Paint.Style style, float textSize, float strokeWidth) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(color);
        paint.setStyle(style);
        if (textSize > 0.0f) {
            paint.setTextSize(textSize);
        }
        if (strokeWidth > 0.0f) {
            paint.setStrokeWidth(strokeWidth);
        }
        return paint;
    }

    private void drawCircle(Canvas canvas, double x, double y, double radius, Paint strokePaint, Paint centerPaint) {
        canvas.drawCircle((float) x, (float) y, (float) radius, strokePaint);
        if (centerPaint != null) {
            canvas.drawCircle((float) x, (float) y, 6.0f, centerPaint);
        }
    }

    private void drawLabel(Canvas canvas, String label, float x, float y, Paint textPaint, Paint backgroundPaint) {
        Paint.FontMetrics metrics = textPaint.getFontMetrics();
        float paddingX = 10.0f;
        float paddingY = 8.0f;
        float width = textPaint.measureText(label);
        float top = y + metrics.ascent - paddingY;
        float bottom = y + metrics.descent + paddingY;
        canvas.drawRect(x - paddingX, top, x + width + paddingX, bottom, backgroundPaint);
        canvas.drawText(label, x, y, textPaint);
    }

    private String describeTopCandidates(List<VideoAnalysisModule.FrameHoughDebugCircle> candidates, FrameExpectation expectation) {
        if (candidates == null || candidates.isEmpty()) {
            return "[]";
        }

        int topCount = Math.min(MAX_TOP_CANDIDATES, candidates.size());
        List<String> topThree = new ArrayList<>();
        for (int index = 0; index < topCount; index++) {
            VideoAnalysisModule.FrameHoughDebugCircle circle = candidates.get(index);
            double distance = Math.hypot(circle.x - expectation.expectedX, circle.y - expectation.expectedY);
            topThree.add(
                "idx=" + index +
                    " x=" + round(circle.x) +
                    " y=" + round(circle.y) +
                    " r=" + round(circle.radius) +
                    " score=" + round(circle.score) +
                    " dist=" + round(distance)
            );
        }
        return topThree.toString();
    }

    private static class FrameExpectation {
        final String assetPath;
        final double hintX;
        final double hintY;
        final double hintRadius;
        final double expectedX;
        final double expectedY;
        final double expectedRadius;
        final double maxDistancePx;

        private FrameExpectation(
            String assetPath,
            double hintX,
            double hintY,
            double hintRadius,
            double expectedX,
            double expectedY,
            double expectedRadius,
            double maxDistancePx
        ) {
            this.assetPath = assetPath;
            this.hintX = hintX;
            this.hintY = hintY;
            this.hintRadius = hintRadius;
            this.expectedX = expectedX;
            this.expectedY = expectedY;
            this.expectedRadius = expectedRadius;
            this.maxDistancePx = maxDistancePx;
        }

        static FrameExpectation hintless(String assetPath, double expectedX, double expectedY, double expectedRadius, double maxDistancePx) {
            return new FrameExpectation(assetPath, Double.NaN, Double.NaN, Double.NaN, expectedX, expectedY, expectedRadius, maxDistancePx);
        }

        static FrameExpectation hinted(
            String assetPath,
            double hintX,
            double hintY,
            double hintRadius,
            double expectedX,
            double expectedY,
            double expectedRadius,
            double maxDistancePx
        ) {
            return new FrameExpectation(assetPath, hintX, hintY, hintRadius, expectedX, expectedY, expectedRadius, maxDistancePx);
        }

        String assetName() {
            int slashIndex = assetPath.lastIndexOf('/');
            String fileName = slashIndex >= 0 ? assetPath.substring(slashIndex + 1) : assetPath;
            int dotIndex = fileName.lastIndexOf('.');
            return dotIndex >= 0 ? fileName.substring(0, dotIndex) : fileName;
        }
    }
}
